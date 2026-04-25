import { fetchUserExportBundle } from '@/lib/repositories/userExportRepository';
import { resolveEffectiveNutritionTargets } from '@/lib/nutritionTargets';
import { getIsraelDateKey } from '@/lib/date/getIsraelDateKey';
import {
  renderUserFitnessExportMarkdown,
  USER_FITNESS_EXPORT_TIMEZONE,
  USER_FITNESS_EXPORT_VERSION,
  type ResolvedNutritionTargets,
} from '@/lib/export/userFitnessExportMarkdown';

export type UserFitnessExportFile = {
  fileName: string;
  markdown: string;
  generatedAt: string;
};

export const buildUserFitnessExport = async (): Promise<UserFitnessExportFile> => {
  const bundle = await fetchUserExportBundle();

  const effectiveTargets = resolveEffectiveNutritionTargets({
    profile: bundle.profile
      ? {
          age: bundle.profile.age || 0,
          height: bundle.profile.height || 0,
          gender: bundle.profile.gender || '',
          goal: bundle.profile.goal || '',
          nutritionTargetMode:
            bundle.profile.nutritionTargetMode === 'manual' ? 'manual' : 'auto',
          manualDailyCalories: bundle.profile.manualDailyCalories,
          manualDailyProtein: bundle.profile.manualDailyProtein,
        }
      : null,
    bodyweightLogs: bundle.bodyweightLogs,
  });

  const nutritionTargets: ResolvedNutritionTargets = {
    mode: effectiveTargets.source,
    dailyCaloriesTarget: effectiveTargets.dailyCaloriesTarget,
    dailyProteinTarget: effectiveTargets.dailyProteinTarget,
  };

  const generatedAt = new Date().toISOString();

  const markdown = renderUserFitnessExportMarkdown({
    generatedAt,
    timezone: USER_FITNESS_EXPORT_TIMEZONE,
    exportVersion: USER_FITNESS_EXPORT_VERSION,
    userEmail: bundle.userEmail,
    profile: bundle.profile,
    nutritionTargets,
    bodyweightLogs: bundle.bodyweightLogs,
    bodyMeasurementLogs: bundle.bodyMeasurementLogs,
    nutritionLogs: bundle.nutritionLogs,
    workoutSessions: bundle.workoutSessions,
    weeklyGoalSnapshots: bundle.weeklyGoalSnapshots,
  });

  const israelDateKey = getIsraelDateKey(new Date());
  const fileName = `fitness-export-${israelDateKey}.md`;

  return {
    fileName,
    markdown,
    generatedAt,
  };
};

export const downloadUserFitnessExport = async () => {
  const exportFile = await buildUserFitnessExport();

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return exportFile;
  }

  const blob = new Blob([exportFile.markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = exportFile.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return exportFile;
};
