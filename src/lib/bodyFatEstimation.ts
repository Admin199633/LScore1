import type { BodyMeasurementLog } from '@/lib/repositories/bodyMeasurementRepository';
import type { CurrentProfile } from '@/lib/repositories/profileRepository';

/**
 * US Navy body fat estimation formula.
 * Returns body fat percentage (0–100) or null if required inputs are missing.
 */
export const estimateBodyFatPercent = (
  profile: Pick<CurrentProfile, 'gender' | 'height'> | null | undefined,
  measurement: Pick<
    BodyMeasurementLog,
    'neckCm' | 'abdomenCm' | 'hipsCm'
  > | null | undefined
): number | null => {
  if (!profile || !measurement) {
    return null;
  }

  const { gender, height: heightCm } = profile;
  const { neckCm, abdomenCm } = measurement;

  if (!heightCm || heightCm <= 0 || !neckCm || neckCm <= 0 || !abdomenCm || abdomenCm <= 0) {
    return null;
  }

  if (gender === 'male') {
    const diff = abdomenCm - neckCm;
    if (diff <= 0) {
      return null;
    }
    const bf =
      495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm)) - 450;
    return bf > 0 && bf < 100 ? Math.round(bf * 10) / 10 : null;
  }

  if (gender === 'female') {
    const { hipsCm } = measurement;
    if (!hipsCm || hipsCm <= 0) {
      return null;
    }
    const sum = abdomenCm + hipsCm - neckCm;
    if (sum <= 0) {
      return null;
    }
    const bf =
      495 / (1.29579 - 0.35004 * Math.log10(sum) + 0.221 * Math.log10(heightCm)) - 450;
    return bf > 0 && bf < 100 ? Math.round(bf * 10) / 10 : null;
  }

  return null;
};
