export type DataStatus = 'complete' | 'partial' | 'stale' | 'missing';
export type DataFreshness = 'fresh' | 'aging' | 'stale';
export type DataConfidence = 'high' | 'medium' | 'low';

export type DataReliability = {
  dataStatus: DataStatus;
  freshness: DataFreshness;
  confidence: DataConfidence;
  lastUpdatedAt: string | null;
  reliabilityReason?: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const normalizeDateInput = (value?: string | Date) => {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  const normalized = String(value || '').trim();
  if (!normalized) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  const [year, month, day] = normalized.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  return new Date(Date.UTC(year, month - 1, day));
};

export const diffDaysFromCurrentDate = (date: string | null, currentDate?: string | Date) => {
  if (!date) {
    return null;
  }

  const target = normalizeDateInput(date);
  const current = normalizeDateInput(currentDate);
  return Math.floor((current.getTime() - target.getTime()) / MS_PER_DAY);
};

export const getLatestDate = (dates: Array<string | null | undefined>) => {
  const normalizedDates = dates.map((date) => String(date || '').slice(0, 10)).filter(Boolean);
  if (normalizedDates.length === 0) {
    return null;
  }

  return [...normalizedDates].sort((left, right) => left.localeCompare(right)).at(-1) || null;
};
