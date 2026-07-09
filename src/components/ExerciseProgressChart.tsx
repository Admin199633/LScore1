'use client';

import { useState } from 'react';
import type { ExerciseExerciseOccurrence } from '@/lib/exerciseProgress';

type ChartPoint = {
  x: number;
  y: number;
  date: string;
  label: string;
  score: number;
  weight: number;
  reps: number;
  volume: number;
  difficulty: string;
  isLast: boolean;
};

const formatFullDate = (date: string) => {
  const [year, month, day] = String(date || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
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
      volume: occurrence.bestSet.weight * occurrence.bestSet.reps,
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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
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
  const band =
    points.length > 1 ? points[1].x - points[0].x : 100 - PADDING_LEFT - PADDING_RIGHT;
  const activePoint = activeIndex !== null ? points[activeIndex] ?? null : null;

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

      <div style={{ position: 'relative' }} onMouseLeave={() => setActiveIndex(null)}>
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

        {points.map((point, index) => {
          const isActive = index === activeIndex;
          return (
            <circle
              key={`${point.date}-${point.x}`}
              cx={point.x}
              cy={point.y}
              r={isActive ? 3.4 : point.isLast ? 2.8 : 1.8}
              fill={point.isLast || isActive ? 'var(--accent-2)' : 'var(--accent)'}
              stroke='var(--surface-2)'
              strokeWidth='0.8'
            />
          );
        })}

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

        {/* Transparent per-point hit targets for hover/tap tooltips */}
        {points.map((point, index) => (
          <rect
            key={`${point.date}-hit`}
            x={point.x - band / 2}
            y={0}
            width={band}
            height={CHART_HEIGHT}
            fill='transparent'
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => setActiveIndex((current) => (current === index ? null : index))}
          />
        ))}
      </svg>

      {activePoint ? (
        <div
          style={{
            position: 'absolute',
            left: `${activePoint.x}%`,
            top: activePoint.y,
            transform: `translate(${activePoint.x > 60 ? '-100%' : activePoint.x < 40 ? '0' : '-50%'}, calc(-100% - 8px))`,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '8px 10px',
            display: 'grid',
            gap: 2,
            pointerEvents: 'none',
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
            whiteSpace: 'nowrap',
            zIndex: 2,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800 }}>{formatFullDate(activePoint.date)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>משקל: {activePoint.weight}kg</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>חזרות: {activePoint.reps}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            נפח: {Math.round(activePoint.volume).toLocaleString('en-US')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {formatDifficulty(activePoint.difficulty)} · {activePoint.score.toFixed(1)}
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
