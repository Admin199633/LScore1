import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runWorkoutSave,
  collectExerciseDurations,
  countTotalSets,
  createClientWorkoutId,
  WORKOUT_SESSION_ALREADY_EXISTS,
  WORKOUT_SAVE_FAILED_MESSAGE,
  WORKOUT_SAVE_UNVERIFIED_MESSAGE,
  type WorkoutSaveDeps,
  type WorkoutSaveInput,
  type WorkoutVerifyResult,
} from '../workoutSaveService.ts';

const foundVerify = (sessionId: string | null = 'session-1'): WorkoutVerifyResult => ({
  found: true,
  sessionId,
  userIdMatches: true,
  exerciseCount: 2,
  setCount: 3,
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const makeInput = (overrides: Partial<WorkoutSaveInput> = {}): WorkoutSaveInput => ({
  clientWorkoutId: 'cwid-1',
  overwrite: false,
  date: '2026-07-21',
  dayId: 'day-b-uuid',
  dayName: 'B',
  programId: 'prog-1',
  energyLevel: 'normal',
  startedAt: '2026-07-21T05:00:00.000Z',
  endedAt: '2026-07-21T06:00:00.000Z',
  durationSeconds: 3600,
  reorderCount: 2,
  exerciseNotes: { 'Bench Press': 'felt strong' },
  exercises: [
    {
      exerciseId: 'ex-1',
      exerciseName: 'Bench Press',
      plannedSets: '3',
      plannedReps: '8',
      plannedWeight: '60',
      completed: true,
      durationSeconds: 300,
      sets: [
        { weight: '60', reps: '8', difficulty: 'good' },
        { weight: '60', reps: '7', difficulty: 'hard' },
      ],
    },
    {
      // Ad-hoc exercise added mid-workout (empty exerciseId).
      exerciseId: '',
      exerciseName: 'Cable Crunch',
      plannedSets: '',
      plannedReps: '',
      plannedWeight: '',
      completed: true,
      durationSeconds: 120,
      sets: [{ weight: '20', reps: '15', difficulty: 'good' }],
    },
  ],
  ...overrides,
});

type Recorder = {
  deps: WorkoutSaveDeps;
  calls: string[];
  savedInputs: WorkoutSaveInput[];
  cleared: number;
};

const makeDeps = (opts: {
  saveSession?: WorkoutSaveDeps['saveSession'];
  updateDurations?: WorkoutSaveDeps['updateDurations'];
  updateNotes?: WorkoutSaveDeps['updateNotes'];
  updateReorder?: WorkoutSaveDeps['updateReorder'];
} = {}): Recorder => {
  const calls: string[] = [];
  const savedInputs: WorkoutSaveInput[] = [];
  let cleared = 0;

  const rec: Recorder = {
    calls,
    savedInputs,
    get cleared() {
      return cleared;
    },
    deps: {
      saveSession:
        opts.saveSession ??
        (async (input) => {
          calls.push('saveSession');
          savedInputs.push(input);
          return { sessionId: 'session-1', alreadyExisted: false };
        }),
      updateDurations:
        opts.updateDurations ??
        (async () => {
          calls.push('updateDurations');
        }),
      updateNotes:
        opts.updateNotes ??
        (async () => {
          calls.push('updateNotes');
        }),
      updateReorder:
        opts.updateReorder ??
        (async () => {
          calls.push('updateReorder');
        }),
      clearDraft: () => {
        calls.push('clearDraft');
        cleared += 1;
      },
      getUserId: async () => 'user-1',
      log: () => {},
    },
  } as unknown as Recorder;

  return rec;
};

// ---------------------------------------------------------------------------
// 1. Successful save
// ---------------------------------------------------------------------------
test('successful save clears the draft and reports saved', async () => {
  const rec = makeDeps();
  const result = await runWorkoutSave(rec.deps, makeInput());

  assert.equal(result.status, 'saved');
  if (result.status === 'saved') {
    assert.equal(result.sessionId, 'session-1');
    assert.equal(result.softErrors.length, 0);
  }
  assert.equal(rec.cleared, 1, 'draft cleared exactly once on success');
  assert.deepEqual(rec.calls, [
    'saveSession',
    'updateDurations',
    'updateNotes',
    'updateReorder',
    'clearDraft',
  ]);
});

// ---------------------------------------------------------------------------
// 2. Session insert failure  /  3. exercise  /  4. set  /  5. network
// (all manifest as saveSession throwing — the session is the atomic unit)
// ---------------------------------------------------------------------------
for (const label of ['session insert', 'exercise insert', 'set insert', 'network interruption']) {
  test(`${label} failure keeps the draft and returns a retryable Hebrew error`, async () => {
    const rec = makeDeps({
      saveSession: async () => {
        throw new Error(`${label} failed`);
      },
    });
    const result = await runWorkoutSave(rec.deps, makeInput());

    assert.equal(result.status, 'failed');
    if (result.status === 'failed') {
      assert.equal(result.stage, 'session');
      assert.equal(result.userMessage, WORKOUT_SAVE_FAILED_MESSAGE);
    }
    assert.equal(rec.cleared, 0, 'draft is preserved after a failed save');
    assert.ok(!rec.calls.includes('clearDraft'));
  });
}

// ---------------------------------------------------------------------------
// 10. Already-exists -> caller must confirm overwrite; draft preserved
// ---------------------------------------------------------------------------
test('WORKOUT_SESSION_ALREADY_EXISTS surfaces as "exists" and keeps the draft', async () => {
  const rec = makeDeps({
    saveSession: async () => {
      throw new Error(`duplicate key: ${WORKOUT_SESSION_ALREADY_EXISTS}`);
    },
  });
  const result = await runWorkoutSave(rec.deps, makeInput());
  assert.equal(result.status, 'exists');
  assert.equal(rec.cleared, 0);
});

// ---------------------------------------------------------------------------
// 7 / 8. Retry after server committed but client lost the response
// (idempotent replay: DB returns the same row, no duplicate)
// ---------------------------------------------------------------------------
test('idempotent replay returns saved without creating a duplicate', async () => {
  let calls = 0;
  const rec = makeDeps({
    saveSession: async () => {
      calls += 1;
      // Simulate the DB deduping by client_workout_id.
      return { sessionId: 'session-1', alreadyExisted: true };
    },
  });
  const result = await runWorkoutSave(rec.deps, makeInput());
  assert.equal(result.status, 'saved');
  if (result.status === 'saved') {
    assert.equal(result.alreadyExisted, true);
  }
  assert.equal(calls, 1);
  assert.equal(rec.cleared, 1);
});

// ---------------------------------------------------------------------------
// 6. Retry after failure eventually succeeds, reusing the same idempotency key
// ---------------------------------------------------------------------------
test('retry after a failed save succeeds and reuses the idempotency key', async () => {
  let attempt = 0;
  const seenKeys: string[] = [];
  const deps = makeDeps({
    saveSession: async (input) => {
      attempt += 1;
      seenKeys.push(input.clientWorkoutId);
      if (attempt === 1) throw new Error('temporary network error');
      return { sessionId: 'session-1', alreadyExisted: false };
    },
  });

  const input = makeInput({ clientWorkoutId: 'stable-key' });

  const first = await runWorkoutSave(deps.deps, input);
  assert.equal(first.status, 'failed');
  assert.equal(deps.cleared, 0);

  const second = await runWorkoutSave(deps.deps, input);
  assert.equal(second.status, 'saved');
  assert.equal(deps.cleared, 1);
  assert.deepEqual(seenKeys, ['stable-key', 'stable-key']);
});

// ---------------------------------------------------------------------------
// 11. Secondary metadata failure does NOT fail the confirmed session save
// ---------------------------------------------------------------------------
test('a secondary (reorder) failure still commits the session as saved', async () => {
  const rec = makeDeps({
    updateReorder: async () => {
      throw new Error('reorder update failed');
    },
  });
  const result = await runWorkoutSave(rec.deps, makeInput());
  assert.equal(result.status, 'saved');
  if (result.status === 'saved') {
    assert.equal(result.softErrors.length, 1);
    assert.equal(result.softErrors[0].stage, 'reorder');
  }
  assert.equal(rec.cleared, 1, 'session is confirmed, so the draft is cleared');
});

// ---------------------------------------------------------------------------
// 13. ABCD day isolation — the exact day identity is forwarded to persistence
// 14. Ad-hoc exercises and their sets are preserved
// ---------------------------------------------------------------------------
test('day identity (B) and ad-hoc exercise are forwarded to persistence intact', async () => {
  const rec = makeDeps();
  await runWorkoutSave(rec.deps, makeInput());
  const saved = rec.savedInputs[0];
  assert.equal(saved.dayId, 'day-b-uuid');
  assert.equal(saved.dayName, 'B');

  const adHoc = saved.exercises.find((e) => e.exerciseName === 'Cable Crunch');
  assert.ok(adHoc, 'ad-hoc exercise preserved');
  assert.equal(adHoc?.exerciseId, '');
  assert.equal(adHoc?.sets.length, 1);
});

test('overwrite flag is forwarded so the DB can delete-then-insert atomically', async () => {
  const rec = makeDeps();
  await runWorkoutSave(rec.deps, makeInput({ overwrite: true }));
  assert.equal(rec.savedInputs[0].overwrite, true);
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------
test('collectExerciseDurations maps only exercises with a duration', () => {
  const durations = collectExerciseDurations(makeInput().exercises);
  assert.deepEqual(durations, { 'Bench Press': 300, 'Cable Crunch': 120 });
});

test('countTotalSets sums sets across exercises', () => {
  assert.equal(countTotalSets(makeInput().exercises), 3);
});

test('createClientWorkoutId returns a non-empty unique-ish string', () => {
  const a = createClientWorkoutId();
  const b = createClientWorkoutId();
  assert.ok(a.length > 0);
  assert.notEqual(a, b);
});

// ---------------------------------------------------------------------------
// Read-after-write verification — the false-success regression guard
// ---------------------------------------------------------------------------

test('save that returns no error but is NOT found -> failed(verify), draft kept', async () => {
  const rec = makeDeps();
  const deps: WorkoutSaveDeps = {
    ...rec.deps,
    verifySaved: async () => ({
      found: false,
      sessionId: null,
      userIdMatches: false,
      exerciseCount: 0,
      setCount: 0,
    }),
  };
  const result = await runWorkoutSave(deps, makeInput());
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') {
    assert.equal(result.stage, 'verify');
    assert.equal(result.userMessage, WORKOUT_SAVE_UNVERIFIED_MESSAGE);
  }
  assert.equal(rec.cleared, 0, 'draft preserved when persistence is not confirmed');
});

test('persisted row owned by another user -> failed(verify), draft kept', async () => {
  const rec = makeDeps();
  const deps: WorkoutSaveDeps = {
    ...rec.deps,
    verifySaved: async () => ({
      found: true,
      sessionId: 'session-x',
      userIdMatches: false,
      exerciseCount: 2,
      setCount: 3,
    }),
  };
  const result = await runWorkoutSave(deps, makeInput());
  assert.equal(result.status, 'failed');
  assert.equal(rec.cleared, 0);
});

test('verifySaved throwing -> failed(verify), draft kept', async () => {
  const rec = makeDeps();
  const deps: WorkoutSaveDeps = {
    ...rec.deps,
    verifySaved: async () => {
      throw new Error('verify query failed');
    },
  };
  const result = await runWorkoutSave(deps, makeInput());
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') assert.equal(result.stage, 'verify');
  assert.equal(rec.cleared, 0);
});

test('null RPC id but verification finds the row by identity -> saved', async () => {
  const rec = makeDeps({
    saveSession: async () => ({ sessionId: null, alreadyExisted: false, rpcPath: 'create_workout_session' }),
  });
  const deps: WorkoutSaveDeps = {
    ...rec.deps,
    verifySaved: async () => foundVerify('resolved-session-id'),
  };
  const result = await runWorkoutSave(deps, makeInput());
  assert.equal(result.status, 'saved');
  if (result.status === 'saved') {
    assert.equal(result.sessionId, 'resolved-session-id', 'adopts verified id');
  }
  assert.equal(rec.cleared, 1, 'confirmed persistence clears the draft');
});

test('verification passing keeps the full happy-path saved result', async () => {
  const rec = makeDeps();
  const deps: WorkoutSaveDeps = { ...rec.deps, verifySaved: async () => foundVerify() };
  const result = await runWorkoutSave(deps, makeInput());
  assert.equal(result.status, 'saved');
  assert.equal(rec.cleared, 1);
});
