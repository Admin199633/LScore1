'use client';

type BodyweightLog = {
  date: string;
  weight: number;
};

const CHART_HEIGHT = 220;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 34;
const PADDING_LEFT = 8;
const PADDING_RIGHT = 24;
const Y_AXIS_WIDTH = 46;

const formatAxisDate = (date: string) => {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) {
    return date;
  }

  return `${day}/${month}`;
};

const buildPoints = (logs: BodyweightLog[]) => {
  const orderedLogs = [...logs].sort((left, right) => left.date.localeCompare(right.date));

  if (orderedLogs.length === 0) {
    return { points: [], width: 0, minWeight: 0, maxWeight: 0 };
  }

  const width = Math.max(320, orderedLogs.length * 72);
  const minWeight = Math.min(...orderedLogs.map((entry) => entry.weight));
  const maxWeight = Math.max(...orderedLogs.map((entry) => entry.weight));
  const spread = maxWeight - minWeight || 1;
  const usableHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const step = orderedLogs.length > 1 ? (width - PADDING_LEFT - PADDING_RIGHT) / (orderedLogs.length - 1) : 0;

  const points = orderedLogs.map((entry, index) => {
    const x = PADDING_LEFT + step * index;
    const y = PADDING_TOP + usableHeight - ((entry.weight - minWeight) / spread) * usableHeight;

    return {
      ...entry,
      x,
      y,
      label: formatAxisDate(entry.date),
    };
  });

  return { points, width, minWeight, maxWeight };
};

const buildLinePath = (points: Array<{ x: number; y: number }>) =>
  points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

export function BodyweightChart({ logs }: { logs: BodyweightLog[] }) {
  const { points, width, minWeight, maxWeight } = buildPoints(logs);

  if (points.length === 0) {
    return (
      <div
        style={{
          background: 'var(--surface-2)',
          borderRadius: 18,
          padding: 16,
          display: 'grid',
          gap: 6,
        }}
      >
        <div style={{ fontWeight: 800 }}>אין עדיין נתוני משקל</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          שמור שקילה ראשונה כדי להתחיל לעקוב אחרי המגמה.
        </div>
      </div>
    );
  }

  if (points.length === 1) {
    return (
      <div
        style={{
          background: 'var(--surface-2)',
          borderRadius: 18,
          padding: 16,
          display: 'grid',
          gap: 6,
        }}
      >
        <div style={{ fontWeight: 800 }}>נשמרה שקילה אחת</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          צריך לפחות שתי שקילות כדי להציג גרף התקדמות.
        </div>
        <div style={{ color: 'var(--accent)', fontWeight: 800, fontSize: 22 }}>
          {points[0].weight.toFixed(1)} ק״ג
        </div>
      </div>
    );
  }

  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  const baselineY = CHART_HEIGHT - PADDING_BOTTOM;

  const midWeight = (minWeight + maxWeight) / 2;
  const midY = (PADDING_TOP + baselineY) / 2;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: 0, overflow: 'hidden' }}>
      {/* Y-axis — lives outside the scroll container so it never moves */}
      <svg width={Y_AXIS_WIDTH} height={CHART_HEIGHT} style={{ flexShrink: 0 }}>
        <text
          x={Y_AXIS_WIDTH - 4}
          y={PADDING_TOP + 4}
          fontSize="11"
          fill="rgba(255,255,255,0.35)"
          textAnchor="end"
        >
          {maxWeight.toFixed(1)}
        </text>
        <text
          x={Y_AXIS_WIDTH - 4}
          y={midY + 4}
          fontSize="11"
          fill="rgba(255,255,255,0.35)"
          textAnchor="end"
        >
          {midWeight.toFixed(1)}
        </text>
        <text
          x={Y_AXIS_WIDTH - 4}
          y={baselineY + 4}
          fontSize="11"
          fill="rgba(255,255,255,0.35)"
          textAnchor="end"
        >
          {minWeight.toFixed(1)}
        </text>
      </svg>

      {/* Scrollable chart area — only this part moves */}
      <div style={{ overflowX: 'auto', flex: 1 }}>
        <svg width={width} height={CHART_HEIGHT}>
          {/* Horizontal grid lines */}
          <line
            x1={PADDING_LEFT}
            y1={PADDING_TOP}
            x2={width - PADDING_RIGHT}
            y2={PADDING_TOP}
            stroke="var(--border)"
            strokeWidth="1"
          />
          <line
            x1={PADDING_LEFT}
            y1={midY}
            x2={width - PADDING_RIGHT}
            y2={midY}
            stroke="var(--border)"
            strokeWidth="1"
          />
          <line
            x1={PADDING_LEFT}
            y1={baselineY}
            x2={width - PADDING_RIGHT}
            y2={baselineY}
            stroke="var(--border)"
            strokeWidth="1.5"
          />

          {/* Chart line and dots */}
          <path
            d={buildLinePath(points)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((point) => (
            <circle key={point.date} cx={point.x} cy={point.y} r="5" fill="var(--accent)" />
          ))}

          {/* X-axis date labels */}
          {points.map((point, index) =>
            index % labelStep === 0 || index === points.length - 1 ? (
              <text
                key={`${point.date}-label`}
                x={point.x}
                y={CHART_HEIGHT - 10}
                fontSize="11"
                fill="var(--text-muted)"
                textAnchor="middle"
              >
                {point.label}
              </text>
            ) : null
          )}
        </svg>
      </div>
    </div>
  );
}

