export type WeekRange = {
  startOfWeek: string;
  endOfWeek: string;
};

export type WeeklyDecisionWindow = {
  startDate: string;
  endDate: string;
  windowDays: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfLocalDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const normalizeDateInput = (value?: string | Date) => {
  if (value instanceof Date) {
    return startOfLocalDay(value);
  }

  const normalized = String(value || '').trim();
  if (!normalized) {
    return startOfLocalDay(new Date());
  }

  const [year, month, day] = normalized.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) {
    return startOfLocalDay(new Date());
  }

  return new Date(year, month - 1, day);
};

export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date.getTime() + days * MS_PER_DAY);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const getCurrentWeekRange = (date?: string | Date): WeekRange => {
  const currentDate = normalizeDateInput(date);
  const dayOfWeek = currentDate.getDay();
  const startOfWeek = addDays(currentDate, -dayOfWeek);
  const endOfWeek = addDays(startOfWeek, 6);

  return {
    startOfWeek: toDateKey(startOfWeek),
    endOfWeek: toDateKey(endOfWeek),
  };
};

export const getPreviousWeekRange = (date?: string | Date): WeekRange => {
  const currentWeek = getCurrentWeekRange(date);
  const previousWeekStart = addDays(normalizeDateInput(currentWeek.startOfWeek), -7);
  const previousWeekEnd = addDays(previousWeekStart, 6);

  return {
    startOfWeek: toDateKey(previousWeekStart),
    endOfWeek: toDateKey(previousWeekEnd),
  };
};

export const getWeeklyDecisionWindow = (
  date?: string | Date,
  windowDays = 14
): WeeklyDecisionWindow => {
  const normalizedWindowDays = Math.max(1, Math.floor(windowDays));
  const endDate = normalizeDateInput(date);
  const startDate = addDays(endDate, -(normalizedWindowDays - 1));

  return {
    startDate: toDateKey(startDate),
    endDate: toDateKey(endDate),
    windowDays: normalizedWindowDays,
  };
};

export const isDateInRange = (
  value: string | null | undefined,
  range: { startDate?: string; endDate?: string; startOfWeek?: string; endOfWeek?: string }
) => {
  const dateKey = String(value || '').slice(0, 10);
  const start = range.startDate ?? range.startOfWeek;
  const end = range.endDate ?? range.endOfWeek;

  if (!dateKey || !start || !end) {
    return false;
  }

  return dateKey >= start && dateKey <= end;
};
