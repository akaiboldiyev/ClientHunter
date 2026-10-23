import assert from 'node:assert/strict';
import test from 'node:test';
import { BusinessLead } from '../types';
import { hydrateLead, isBusinessWebsite, mergeLeads, normalizeKazakhstanPhone } from './leadData';
import { analyzeLeadOpportunity, filterLeadsBySegment } from './leadScoring';

const lead = (patch: Partial<BusinessLead> = {}): BusinessLead => hydrateLead({
  id: 'one', name: 'Компания', phone: '+7 777 123 45 67', address: 'Актау, 1', website: '', rating: 4.5, reviews: 10,
  maps_url: '', city: 'Актау', category: 'стоматология', source: '2gis', scrapedAt: new Date().toISOString(), hasWebsite: false,
  leadQuality: 'warm', status: 'new', ...patch
});

test('normalizes Kazakhstan phones only when format is unambiguous', () => {
  assert.equal(normalizeKazakhstanPhone('8 777 123 45 67'), '+77771234567');
  assert.equal(normalizeKazakhstanPhone('77771234567'), '+77771234567');
  assert.equal(normalizeKazakhstanPhone('12345'), undefined);
});

test('keeps social and map links out of business website field', () => {
  assert.equal(isBusinessWebsite('https://instagram.com/a_business'), false);
  assert.equal(isBusinessWebsite('https://2gis.ru/aktau/firm/1'), false);
  assert.equal(isBusinessWebsite('https://company.2gis.biz'), false);
  assert.equal(isBusinessWebsite('https://wa.me/77771234567'), false);
  assert.equal(isBusinessWebsite('https://business.kz'), true);
});

test('does not merge two companies solely because an address is missing', () => {
  const first = lead({ id: 'first', phone: '', phones: [], address: '', website: '' });
  const second = lead({ id: 'second', phone: '', phones: [], address: '', website: '' });
  assert.equal(mergeLeads([first, second]).length, 2);
});

test('default WhatsApp state is unknown, including a mobile phone', () => {
  const result = lead();
  assert.equal(result.phones?.[0].type, 'mobile');
  assert.equal(result.whatsappStatus, 'unknown');
});

test('an explicit WhatsApp contact is available', () => {
  const result = lead({ messengers: { whatsapp: { url: 'https://wa.me/77771234567', source: '2gis' } } });
  assert.equal(result.whatsappStatus, 'available');
});

test('merges duplicates by provider ID and normalized phone', () => {
  const providerDuplicate = lead({ id: 'a', providerIds: { '2gis': '42' } });
  const sameProvider = lead({ id: 'b', providerIds: { '2gis': '42' }, rating: 4.9 });
  assert.equal(mergeLeads([providerDuplicate, sameProvider]).length, 1);
  const samePhone = lead({ id: 'c', source: 'manual', sources: ['manual'] });
  assert.equal(mergeLeads([providerDuplicate, samePhone]).length, 1);
});

test('batch-style partial result remains mergeable with a manually added record', () => {
  const twoGis = lead({ id: '2gis', providerIds: { '2gis': '1' } });
  const manual = lead({ id: 'manual', source: 'manual', sources: ['manual'] });
  const merged = mergeLeads([twoGis, manual]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].sources?.sort(), ['2gis', 'manual']);
});

test('merging leads preserves customPitch, whatsappSentAt, and conversation history', () => {
  const existing = lead({
    id: 'lead-1',
    status: 'prepared',
    customPitch: 'Сохранённый питч',
    whatsappSentAt: '2026-10-17T12:00:00.000Z',
    conversationStatus: 'awaiting_reply',
    conversationHistory: [
      { id: '1', sender: 'user', text: 'Сохранённый питч', timestamp: '2026-10-17T12:00:00.000Z' }
    ]
  });
  const incomingFromProvider = lead({
    id: 'lead-provider-refresh',
    providerIds: { '2gis': 'lead-1' },
    status: 'new'
  });
  const merged = mergeLeads([existing, incomingFromProvider]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].customPitch, 'Сохранённый питч');
  assert.equal(merged[0].whatsappSentAt, '2026-10-17T12:00:00.000Z');
  assert.equal(merged[0].conversationStatus, 'awaiting_reply');
  assert.equal(merged[0].conversationHistory?.length, 1);
});

test('merging provider refresh preserves follow-up schedule and status', () => {
  const existing = lead({
    id: 'follow-up-lead',
    followUpStatus: 'active',
    followUpStep: 2,
    followUpDueAt: '2026-10-26T10:00:00.000Z',
    followUpLastSentAt: '2026-10-22T10:00:00.000Z',
    whatsappOptInAt: '2026-10-20T10:00:00.000Z',
    whatsappOptInSource: 'website_form',
    whatsappOptInEvidence: 'Форма подписки #42'
  });
  const refreshed = lead({ id: 'provider-refresh', providerIds: { '2gis': 'follow-up-lead' } });
  const merged = mergeLeads([existing, refreshed]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].followUpStatus, 'active');
  assert.equal(merged[0].followUpStep, 2);
  assert.equal(merged[0].followUpDueAt, '2026-10-26T10:00:00.000Z');
  assert.equal(merged[0].followUpLastSentAt, '2026-10-22T10:00:00.000Z');
  assert.equal(merged[0].whatsappOptInAt, '2026-10-20T10:00:00.000Z');
  assert.equal(merged[0].whatsappOptInSource, 'website_form');
  assert.equal(merged[0].whatsappOptInEvidence, 'Форма подписки #42');
});

test('refusal status excludes lead and sets isRefused', () => {
  const active = lead({ id: 'lead-refused', status: 'contacted', isRefused: false });
  const refused = { ...active, status: 'lost' as const, conversationStatus: 'refused' as const, isRefused: true };
  assert.equal(refused.status, 'lost');
  assert.equal(refused.isRefused, true);
  assert.equal(refused.conversationStatus, 'refused');
});

test('opportunity analysis gives high score to leads without website and with WhatsApp', () => {
  const hot = lead({
    name: 'Стоматология Дент',
    hasWebsite: false,
    whatsappStatus: 'available',
    reviews: 15,
    rating: 4.8
  });
  const analysis = analyzeLeadOpportunity(hot);
  assert.equal(analysis.priorityLevel, 'high');
  assert.ok(analysis.priorityScore >= 75);
  assert.ok(analysis.whySelected.some(w => w.includes('отсутствие официального сайта')));
  assert.ok(analysis.draftMessage.includes('Стоматология Дент'));
  // Ensure no fake flattery like "Поздравляем с рейтингом"
  assert.equal(analysis.draftMessage.includes('Поздравляем с'), false);
});

test('lead segmentation filters by category, city, and website status', () => {
  const l1 = lead({ id: '1', category: 'стоматология', city: 'Актау', hasWebsite: false, whatsappStatus: 'available' });
  const l2 = lead({ id: '2', category: 'автосервис', city: 'Актау', hasWebsite: true, whatsappStatus: 'available' });
  const l3 = lead({ id: '3', category: 'стоматология', city: 'Алматы', hasWebsite: false, whatsappStatus: 'unknown' });

  const filtered = filterLeadsBySegment([l1, l2, l3], { category: 'стоматология', city: 'Актау', onlyWithoutWebsite: true });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, '1');
});
