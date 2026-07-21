import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getIsraelDateKey } from '../getIsraelDateKey.ts';

// Regression tests for the workout "missing from history" root cause: the
// workout page previously stamped session_date with new Date().toISOString()
// (UTC), which buckets early-morning Israel workouts under the PREVIOUS calendar
// day. getIsraelDateKey (Asia/Jerusalem) is the single source of truth used by
// the rest of the app and must be used for the workout date too.

test('summer (UTC+3): 22:30Z is already the next Israel day', () => {
  // 2026-07-20T22:30:00Z === 2026-07-21 01:30 in Jerusalem (DST, UTC+3).
  const instant = new Date('2026-07-20T22:30:00Z');
  assert.equal(getIsraelDateKey(instant), '2026-07-21');
  // The old UTC-based logic would have produced the wrong day:
  assert.equal(instant.toISOString().slice(0, 10), '2026-07-20');
});

test('winter (UTC+2): 22:30Z is already the next Israel day', () => {
  // 2026-01-20T22:30:00Z === 2026-01-21 00:30 in Jerusalem (standard, UTC+2).
  const instant = new Date('2026-01-20T22:30:00Z');
  assert.equal(getIsraelDateKey(instant), '2026-01-21');
});

test('midday is stable across the timezone offset', () => {
  const instant = new Date('2026-07-21T09:00:00Z'); // 12:00 Jerusalem
  assert.equal(getIsraelDateKey(instant), '2026-07-21');
});

test('key format is YYYY-MM-DD', () => {
  assert.match(getIsraelDateKey(new Date('2026-07-21T09:00:00Z')), /^\d{4}-\d{2}-\d{2}$/);
});
