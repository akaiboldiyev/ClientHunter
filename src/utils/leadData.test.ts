import assert from 'node:assert/strict';
import test from 'node:test';
import { BusinessLead } from '../types';
import { hydrateLead, isBusinessWebsite, mergeLeads, normalizeKazakhstanPhone } from './leadData';

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
