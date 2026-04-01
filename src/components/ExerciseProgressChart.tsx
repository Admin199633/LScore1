'use client';

import type { ExerciseExerciseOccurrence } from '@/lib/exerciseProgress';

type ChartPoint = {
  x: number;
  y: number;
  date: string;
  label: string;
  score: number;
  weight: number;
  reps: number;
  difficulty: string;
  isLast: boolean;
};

const CHART_HEIGHT = 180;
const PADDING_TOP = 18;
const PADDING_BOTTOM = 30;
const PADDING_LEFT = 10;
const PADDING_RIGHT = 10;
const MAX_POINTS = 12;

const formatAxisDate = (date: string) => {
  const [year, month, day] = String(date || '').split('-');
  if (!year || !month || !day) {
    return date;
  }

  return `${day}/${month}`;
};

const formatDifficulty = (difficulty: string) => {
  switch (difficulty) {
    case 'easy':
      return 'קל';
    case 'hard':
      return 'קשה';
    case 'failure':
      return 'כשל';
    case 'good':
    default:
      return 'סבבה';
  }
};

const buildSmoothPath = (points: ChartPoint[]) => {
  if (points.length === 0) {
    return '';
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;

    path += ` Q ${controlX} ${current.y}, ${next.x} ${next.y}`;
  }

  return path;
};

const buildPoints = (occurrences: ExerciseExerciseOccurrence[]) => {
  const orderedOccurrences = [...occurrences]
    .sort((left, right) => {
      const leftKey = `${left.date}T${left.startedAt || '00:00:00'}`;
      const rightKey = `${right.date}T${right.startedAt || '00:00:00'}`;
      return leftKey.localeCompare(rightKey);
    })
    .slice(-MAX_POINTS);

  if (orderedOccurrences.length < 2) {
    return { points: [], minScore: 0, maxScore: 0 };
  }

  const scores = orderedOccurrences.map((occurrence) => occurrence.bestSet.adjustedScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreSpread = maxScore - minScore || 1;
  const usableHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const step =
    orderedOccurrences.length > 1
      ? (100 - PADDING_LEFT - PADDING_RIGHT) / (orderedOccurrences.length - 1)
      : 0;

  const points = orderedOccurrences.map((occurrence, index) => {
    const score = occurrence.bestSet.adjustedScore;
    const x = PADDING_LEFT + step * index;
    const y = PADDING_TOP + usableHeight - ((score - minScore) / scoreSpread) * usableHeight;

    return {
      x,
      y,
      date: occurrence.date,
      label: formatAxisDate(occurrence.date),
      score,
      weight: occurrence.bestSet.weight,
      reps: occurrence.bestSet.reps,
      difficulty: occurrence.bestSet.difficulty,
      isLast: index === orderedOccurrences.length - 1,
    };
  });

  return { points, minScore, maxScore };
};

export function ExerciseProgressChart({
  occurrences,
}: {
  occurrences: ExerciseExerciseOccurrence[];
}) {
  const { points, minScore, maxScore } = buildPoints(occurrences);

  if (points.length < 2) {
    return (
      <div
        style={{
          background: 'var(--surface-2)',
          borderRadius: 16,
          padding: 16,
          display: 'grid',
          gap: 6,
        }}
      >
        <div style={{ fontWeight: 700 }}>אין מספיק נתונים לגרף</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 }}>
          הגרף יוצג אחרי שיהיו לפחות 2 אימונים עם ביצוע בפועל של אותו תרגיל.
        </div>
      </div>
    );
  }

  const path = buildSmoothPath(points);
  const labelStep = Math.max(1, Math.ceil(points.length / 5));

  return (
    <div
      style={{
        background: 'var(--surface-2)',
        borderRadius: 16,
        padding: 16,
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>מגמת ביצועים</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          Performance Score
        </div>
      </div>

      <svg viewBox={`0 0 100 ${CHART_HEIGHT}`} width='100%' height={CHART_HEIGHT} preserveAspectRatio='none'>
        <line
          x1={PADDING_LEFT}
          y1={PADDING_TOP}
          x2={100 - PADDING_RIGHT}
          y2={PADDING_TOP}
          stroke='var(--border)'
          strokeWidth='0.6'
        />
        <line
          x1={PADDING_LEFT}
          y1={(PADDING_TOP + (CHART_HEIGHT - PADDING_BOTTOM)) / 2}
          x2={100 - PADDING_RIGHT}
          y2={(PADDING_TOP + (CHART_HEIGHT - PADDING_BOTTOM)) / 2}
          stroke='var(--border)'
          strokeWidth='0.6'
        />
        <line
          x1={PADDING_LEFT}
          y1={CHART_HEIGHT - PADDING_BOTTOM}
          x2={100 - PADDING_RIGHT}
          y2={CHART_HEIGHT - PADDING_BOTTOM}
          stroke='var(--border)'
          strokeWidth='0.8'
        />

        <path
          d={path}
          fill='none'
          stroke='var(--accent)'
          strokeWidth='2.2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />

        {points.map((point) => (
          <circle
            key={`${point.date}-${point.x}`}
            cx={point.x}
            cy={point.y}
            r={point.isLast ? 2.8 : 1.8}
            fill={point.isLast ? 'var(--accent-2)' : 'var(--accent)'}
            stroke='var(--surface-2)'
            strokeWidth='0.8'
          >
            <title>{`${point.weight}kg x ${point.reps} | ${formatDifficulty(point.difficulty)} | ${point.score.toFixed(1)}`}</title>
          </circle>
        ))}

        {points.map((point, index) =>
          index % labelStep === 0 || point.isLast ? (
            <text
              key={`${point.date}-label`}
              x={point.x}
              y={CHART_HEIGHT - 10}
              fontSize='4.2'
              fill='var(--text-muted)'
              textAnchor='middle'
            >
              {point.label}
            </text>
          ) : null
        )}

        <text
          x={99}
          y={PADDING_TOP + 4}
          fontSize='4'
          fill='var(--text-muted)'
          textAnchor='end'
        >
          {maxScore.toFixed(1)}
        </text>
        <text
          x={99}
          y={CHART_HEIGHT - PADDING_BOTTOM + 4}
          fontSize='4'
          fill='var(--text-muted)'
          textAnchor='end'
        >
          {minScore.toFixed(1)}
        </text>
      </svg>
    </div>
  );
}
