export const ISRAEL_TIME_ZONE = 'Asia/Jerusalem';

const ISRAEL_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: ISRAEL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const getIsraelDateParts = (date: Date) => {
  const parts = ISRAEL_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to resolve Israel date parts.');
  }

  return { year, month, day };
};

export const getIsraelDateKey = (date: Date = new Date()) => {
  const { year, month, day } = getIsraelDateParts(date);
  return `${year}-${month}-${day}`;
};

export const getMillisecondsUntilNextIsraelMidnight = (now: Date = new Date()) => {
  const currentKey = getIsraelDateKey(now);
  let low = now.getTime() + 1;
  let high = now.getTime() + 36 * 60 * 60 * 1000;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midKey = getIsraelDateKey(new Date(mid));

    if (midKey === currentKey) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return Math.max(1, low - now.getTime());
};
