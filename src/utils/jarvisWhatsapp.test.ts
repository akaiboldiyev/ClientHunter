import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AUTOMATION_INTERVAL_SEC,
  MAX_AUTOMATION_INTERVAL_SEC,
  MIN_AUTOMATION_INTERVAL_SEC,
  isAutonomousOutreachCandidate,
  isInitialOutreachCandidate,
  normalizeAutomationInterval,
  parseAutomationInterval,
  selectAutonomousOutreachCandidates,
  waitForAutomationInterval
} from '../../jarvisWhatsapp';

test('automation interval uses five seconds by default and accepts inclusive bounds', () => {
  assert.equal(DEFAULT_AUTOMATION_INTERVAL_SEC, 5);
  assert.equal(normalizeAutomationInterval(undefined), 5);
  assert.equal(parseAutomationInterval(MIN_AUTOMATION_INTERVAL_SEC), 1);
  assert.equal(parseAutomationInterval(MAX_AUTOMATION_INTERVAL_SEC), 3600);
  assert.equal(parseAutomationInterval('60'), 60);
});

test('automation interval rejects values outside the allowed integer range', () => {
  assert.equal(parseAutomationInterval(0), undefined);
  assert.equal(parseAutomationInterval(3601), undefined);
  assert.equal(parseAutomationInterval(1.5), undefined);
  assert.equal(parseAutomationInterval(''), undefined);
  assert.equal(parseAutomationInterval('1.5'), undefined);
});

test('stopping automation aborts the waiting interval', async () => {
  const controller = new AbortController();
  const waiting = waitForAutomationInterval(1, controller.signal);
  controller.abort();
  assert.equal(await waiting, false);
});

test('prepared lead can be sent individually when technical WhatsApp criteria are met', () => {
  const eligible = {
    id: 'test-lead',
    customPitch: 'Здравствуйте!',
    whatsappStatus: 'available',
    phone: '+77017504675',
    status: 'prepared'
  };
  assert.equal(isInitialOutreachCandidate(eligible), true);
  assert.equal(isAutonomousOutreachCandidate(eligible), true);
  assert.equal(isAutonomousOutreachCandidate({ ...eligible, status: 'approved' }), true);
  assert.equal(isAutonomousOutreachCandidate({ ...eligible, status: 'prepared' }), true);
  assert.equal(isInitialOutreachCandidate({ ...eligible, whatsappStatus: 'unknown' }), false);
  assert.equal(isInitialOutreachCandidate({ ...eligible, phone: '' }), false);
  assert.equal(isInitialOutreachCandidate({ ...eligible, whatsappSentAt: '2026-01-02T00:00:00.000Z' }), false);
  assert.equal(isInitialOutreachCandidate({ ...eligible, whatsappSendAttemptAt: '2026-01-02T00:00:00.000Z' }), false);
  assert.equal(isInitialOutreachCandidate({ ...eligible, status: 'contacted' }), false);
});

test('autonomous queue includes prepared leads, excludes duplicate or previously sent leads', () => {
  const approved = {
    customPitch: 'Здравствуйте!',
    whatsappStatus: 'available',
    phone: '+77017504675',
    status: 'approved'
  };
  const queue = selectAutonomousOutreachCandidates([
    { ...approved, id: 'first', updatedAt: '2026-01-01T00:00:00.000Z' },
    { ...approved, id: 'duplicate', updatedAt: '2026-01-02T00:00:00.000Z' },
    { ...approved, id: 'prepared', status: 'prepared', phone: '+77017504676', updatedAt: '2026-01-03T00:00:00.000Z' },
    { ...approved, id: 'sent', phone: '+77017504677', whatsappSentAt: '2026-01-03T00:00:00.000Z' },
    { ...approved, id: 'duplicate-history', phone: '+77017504678', conversationHistory: [{ sender: 'jarvis', text: 'sent', delivery: 'sent' }] }
  ]);
  assert.deepEqual(queue.map((lead) => lead.id), ['first', 'prepared']);
});
