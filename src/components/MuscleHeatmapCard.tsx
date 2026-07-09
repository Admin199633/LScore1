'use client';

import { useMemo } from 'react';
import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';
import { calculateMuscleHeatmap } from '@/lib/muscleHeatmap';

// Maps intensity (0..1) to an accent shade so heavily-trained groups read as
// "hotter". Uses the accent hue at varying opacity to stay on-theme.
const barColor = (intensity: number) => {
  if (intensity <= 0) {
    return 'var(--surface-2)';
  }
  const alpha = 0.35 + intensity * 0.65; // 0.35 → 1.0
  return `color-mix(in srgb, var(--accent) ${Math.round(alpha * 100)}%, transparent)`;
};

export function MuscleHeatmapCard({
  sessions,
  windowDays = 30,
}: {
  sessions: SavedWorkoutSession[];
  windowDays?: number;
}) {
  const heatmap = useMemo(
    () => calculateMuscleHeatmap(sessions, { windowDays }),
    [sessions, windowDays]
  );

  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 20,
        padding: 20,
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>מפת שרירים</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{windowDays} ימים אחרונים</div>
      </div>

      {!heatmap.hasData ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
          עדיין אין נתוני אימון מהתקופה האחרונה. שמור אימון כדי לראות את פילוח הנפח לפי קבוצות שריר.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {heatmap.entries.map((entry) => (
            <div
              key={entry.group}
              style={{
                display: 'grid',
                gridTemplateColumns: '72px 1fr',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>{entry.label}</div>
              <div
                style={{
                  position: 'relative',
                  height: 18,
                  borderRadius: 999,
                  background: 'var(--surface-2)',
                  overflow: 'hidden',
                }}
                title={`${entry.label}: נפח ${entry.volume.toLocaleString('en-US')}`}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(entry.intensity * 100, entry.volume > 0 ? 6 : 0)}%`,
                    background: barColor(entry.intensity),
                    borderRadius: 999,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
