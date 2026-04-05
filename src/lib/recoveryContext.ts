export type RecoveryType = 'weight' | 'nutrition' | 'workout' | 'program';

const KNOWN: ReadonlySet<string> = new Set<RecoveryType>([
  'weight',
  'nutrition',
  'workout',
  'program',
]);

export const parseRecoveryParam = (value: string | null | undefined): RecoveryType | null => {
  if (!value || !KNOWN.has(value)) return null;
  return value as RecoveryType;
};

export const withRecovery = (href: string, type: RecoveryType): string =>
  `${href}?recovery=${type}`;
