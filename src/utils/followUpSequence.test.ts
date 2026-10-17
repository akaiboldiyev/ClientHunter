import assert from 'node:assert/strict';
import test from 'node:test';
import { BusinessLead } from '../types';
import { FOLLOW_UP_DAYS, addDays, getFollowUpMessage, nextFollowUpDueAt } from './followUpSequence';

const lead = { id: 'lead-1', name: 'Кафе у моря' } as BusinessLead;

test('follow-up cadence is scheduled at days 2, 5, 9, 14, and 44', () => {
  const start = '2026-10-17T10:00:00.000Z';
  assert.deepEqual(FOLLOW_UP_DAYS, [2, 5, 9, 14, 44]);
  assert.equal(addDays(start, 2), '2026-10-19T10:00:00.000Z');
  assert.equal(nextFollowUpDueAt(start, 0), '2026-10-20T10:00:00.000Z');
  assert.equal(nextFollowUpDueAt(start, 1), '2026-10-21T10:00:00.000Z');
  assert.equal(nextFollowUpDueAt(start, 2), '2026-10-22T10:00:00.000Z');
  assert.equal(nextFollowUpDueAt(start, 3), '2026-11-16T10:00:00.000Z');
  assert.equal(nextFollowUpDueAt(start, 4), undefined);
});

test('last follow-up requires a real new reason and templates are lead-specific', () => {
  assert.match(getFollowUpMessage(lead, 0), /Кафе у моря/);
  assert.match(getFollowUpMessage(lead, 4), /\[добавьте актуальный проект/);
  assert.equal(getFollowUpMessage(lead, 5), '');
});
