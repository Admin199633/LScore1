'use client';

import { useMemo } from 'react';
import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';
import { buildExerciseHistory } from '@/lib/exerciseHistory';

const formatDate = (value: string) => {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const formatWeight = (weight: number) => {
  const rounded = Math.round(weight * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const formatVolume = (volume: number) => Math.round(volume).toLocaleString('en-US');

// "80kg" when every set used the same weight, otherwise "80 / 82.5kg".
const formatWeightsPerSet = (sets: Array<{ weight: number }>) => {
  const weights = sets.map((set) => set.weight);
  const allEqual = weights.every((weight) => weight === weights[0]);
  return allEqual ? `${formatWeight(weights[0])}kg` : `${weights.map(formatWeight).join(' / ')}kg`;
};

const formatRepsPerSet = (sets: Array<{ reps: number }>) => sets.map((set) => set.reps).join(' / ');

export function ExerciseHistoryModal({
  exerciseName,
  sessions,
  isLoading = false,
  onClose,
}: {
  exerciseName: string;
  sessions: SavedWorkoutSession[];
  isLoading?: boolean;
  onClose: () => void;
}) {
  const history = useMemo(
    () => buildExerciseHistory(exerciseName, sessions),
    [exerciseName, sessions]
  );

  const { personalRecords: pr } = history;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 24,
          padding: 20,
          width: '100%',
          maxWidth: 460,
          display: 'grid',
          gap: 16,
          maxHeight: '86vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>היסטוריית תרגיל — {exerciseName}</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 0,
              background: 'var(--surface-2)',
              color: 'var(--text)',
              borderRadius: 999,
              width: 32,
              height: 32,
              fontSize: 18,
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
            טוען היסטוריה...
          </div>
        ) : !history.hasData ? (
          <div
            style={{
              background: 'var(--surface-2)',
              borderRadius: 16,
              padding: 18,
              display: 'grid',
              gap: 6,
            }}
          >
            <div style={{ fontWeight: 800 }}>אין עדיין היסטוריה לתרגיל הזה</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
              אחרי שתשמור אימון עם התרגיל הזה, כאן תופיע ההיסטוריה, השיאים האישיים וההערות.
            </div>
          </div>
        ) : (
          <>
            {/* ── Summary ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 8 }}>
              <SummaryStat label="אימונים" value={String(history.totalWorkouts)} />
              <SummaryStat label="אימון ראשון" value={formatDate(history.firstWorkoutDate || '')} />
              <SummaryStat label="אימון אחרון" value={formatDate(history.lastWorkoutDate || '')} />
            </div>

            {/* ── Personal Records ────────────────────────────────────── */}
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>שיאים אישיים</div>
              {pr.heaviestWeight || pr.bestSingleSet || pr.highestVolume ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  <RecordRow
                    label="🏋️ משקל שיא"
                    value={pr.heaviestWeight ? `${formatWeight(pr.heaviestWeight.weight)}kg` : '—'}
                    date={pr.heaviestWeight?.date}
                  />
                  <RecordRow
                    label="⭐ הסט הטוב ביותר"
                    value={
                      pr.bestSingleSet
                        ? `${formatWeight(pr.bestSingleSet.weight)}kg × ${pr.bestSingleSet.reps}`
                        : '—'
                    }
                    date={pr.bestSingleSet?.date}
                  />
                  <RecordRow
                    label="🔥 נפח שיא"
                    value={pr.highestVolume ? formatVolume(pr.highestVolume.volume) : '—'}
                    date={pr.highestVolume?.date}
                  />
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  אין עדיין מספיק נתונים לחישוב שיאים.
                </div>
              )}
            </div>

            {/* ── Recent workouts ─────────────────────────────────────── */}
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>אימונים אחרונים</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {history.workouts.slice(0, 12).map((workout, index) => (
                  <div
                    key={`${workout.date}-${workout.startedAt}-${index}`}
                    style={{
                      background: 'var(--surface-2)',
                      borderRadius: 14,
                      padding: 12,
                      display: 'grid',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 800, fontSize: 15 }}>{formatDate(workout.date)}</span>
                      <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 13 }}>
                        נפח: {formatVolume(workout.totalVolume)}
                      </span>
                    </div>
                    <div style={{ color: 'var(--text)', fontSize: 14 }}>{formatWeightsPerSet(workout.sets)}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                      חזרות: {formatRepsPerSet(workout.sets)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Previous notes ──────────────────────────────────────── */}
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>הערות קודמות</div>
              {history.notes.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>לא נשמרו הערות לתרגיל הזה.</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {history.notes.map((note, index) => (
                    <div
                      key={`${note.date}-${index}`}
                      style={{
                        background: 'var(--surface-2)',
                        borderRadius: 14,
                        padding: 12,
                        display: 'grid',
                        gap: 4,
                      }}
                    >
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>
                        {formatDate(note.date)}
                      </div>
                      <div style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {note.note}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--surface-2)',
        borderRadius: 14,
        padding: '12px 10px',
        display: 'grid',
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: 'var(--accent)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value || '—'}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function RecordRow({ label, value, date }: { label: string; value: string; date?: string }) {
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
      }}
    >
      <span style={{ fontSize: 14, color: 'var(--text)' }}>{label}</span>
      <span style={{ display: 'grid', gap: 2, textAlign: 'left' }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{value}</span>
        {date ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(date)}</span> : null}
      </span>
    </div>
  );
}
