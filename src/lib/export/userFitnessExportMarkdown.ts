import type { BodyMeasurementLog } from '@/lib/repositories/bodyMeasurementRepository';
import type { SavedNutritionLog } from '@/lib/repositories/nutritionLogRepository';
import type { SavedWorkoutSession } from '@/lib/repositories/workoutSessionRepository';
import type { WeeklyGoalSnapshot } from '@/lib/weeklyGoalSnapshots';
import type { ExportProfileRow } from '@/lib/repositories/userExportRepository';

export const USER_FITNESS_EXPORT_VERSION = '1.0.0';
export const USER_FITNESS_EXPORT_TIMEZONE = 'Asia/Jerusalem';

export type ResolvedNutritionTargets = {
  mode: 'auto' | 'manual';
  dailyCaloriesTarget: number | null;
  dailyProteinTarget: number | null;
};

export type UserFitnessExportInput = {
  generatedAt: string;
  timezone: string;
  exportVersion: string;
  userEmail: string | null;
  profile: ExportProfileRow | null;
  nutritionTargets: ResolvedNutritionTargets;
  bodyweightLogs: Array<{ date: string; weight: number }>;
  bodyMeasurementLogs: BodyMeasurementLog[];
  nutritionLogs: SavedNutritionLog[];
  workoutSessions: SavedWorkoutSession[];
  weeklyGoalSnapshots: WeeklyGoalSnapshot[];
};

const NO_RECORDS = '_No records found._';

const escapeCell = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');

const formatNumber = (value: number | null | undefined, suffix = '') => {
  if (value == null || !Number.isFinite(Number(value))) {
    return '-';
  }

  return `${Number(value)}${suffix}`;
};

const formatOptional = (value: string | null | undefined) => {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed : '-';
};

const formatDuration = (totalSeconds: number | null | undefined) => {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  if (!seconds) {
    return '0s';
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs && !hours) parts.push(`${secs}s`);
  return `${parts.join(' ')} (${seconds}s)`;
};

const sortByDateAscending = <T extends { date: string }>(items: T[]) =>
  [...items].sort((a, b) => a.date.localeCompare(b.date));

const sortByMeasurementDateAscending = (items: BodyMeasurementLog[]) =>
  [...items].sort((a, b) => a.measurementDate.localeCompare(b.measurementDate));

const sortNutritionLogs = (items: SavedNutritionLog[]) =>
  [...items].sort((a, b) => a.date.localeCompare(b.date));

const sortWorkoutSessions = (items: SavedWorkoutSession[]) =>
  [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.startedAt || '').localeCompare(b.startedAt || '');
  });

const sortWeeklySnapshots = (items: WeeklyGoalSnapshot[]) =>
  [...items].sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));

const buildHeader = (input: UserFitnessExportInput) => {
  const lines = [
    '# Gym Tracker — User Fitness Export',
    '',
    `- Generated at: ${input.generatedAt}`,
    `- Timezone: ${input.timezone}`,
    `- Export version: ${input.exportVersion}`,
    `- User email: ${formatOptional(input.userEmail)}`,
  ];
  return lines.join('\n');
};

const buildProfileSection = (profile: ExportProfileRow | null) => {
  const lines = ['## Profile', ''];

  if (!profile) {
    lines.push(NO_RECORDS);
    return lines.join('\n');
  }

  lines.push('| Field | Value |');
  lines.push('|---|---|');
  lines.push(`| Full name | ${escapeCell(formatOptional(profile.fullName))} |`);
  lines.push(`| Email | ${escapeCell(formatOptional(profile.email))} |`);
  lines.push(`| Auth provider | ${escapeCell(formatOptional(profile.authProvider))} |`);
  lines.push(`| Age | ${profile.age != null ? `${profile.age} years` : '-'} |`);
  lines.push(`| Gender | ${escapeCell(formatOptional(profile.gender))} |`);
  lines.push(`| Height | ${profile.height != null ? `${profile.height} cm` : '-'} |`);
  lines.push(`| Goal | ${escapeCell(formatOptional(profile.goal))} |`);
  lines.push(`| Experience | ${escapeCell(formatOptional(profile.experience))} |`);
  lines.push(
    `| Focus areas | ${profile.focusAreas.length ? escapeCell(profile.focusAreas.join(', ')) : '-'} |`
  );
  lines.push(
    `| Training days per week | ${profile.trainingDaysPerWeek != null ? profile.trainingDaysPerWeek : '-'} |`
  );
  lines.push(`| Profile created at | ${escapeCell(formatOptional(profile.createdAt))} |`);
  lines.push(`| Profile updated at | ${escapeCell(formatOptional(profile.updatedAt))} |`);

  lines.push('');
  lines.push('_Note: birthdate and activity level are not stored by this app, so they are not included._');

  return lines.join('\n');
};

const buildNutritionTargetsSection = (
  targets: ResolvedNutritionTargets,
  profile: ExportProfileRow | null
) => {
  const lines = ['## Nutrition Targets', ''];
  lines.push(`- Mode: ${targets.mode}`);
  lines.push(
    `- Daily calories target: ${targets.dailyCaloriesTarget != null ? `${targets.dailyCaloriesTarget} kcal` : '-'}`
  );
  lines.push(
    `- Daily protein target: ${targets.dailyProteinTarget != null ? `${targets.dailyProteinTarget} g` : '-'}`
  );
  if (profile) {
    lines.push(
      `- Profile manual calories override: ${profile.manualDailyCalories != null ? `${profile.manualDailyCalories} kcal` : '-'}`
    );
    lines.push(
      `- Profile manual protein override: ${profile.manualDailyProtein != null ? `${profile.manualDailyProtein} g` : '-'}`
    );
  }
  return lines.join('\n');
};

const buildBodyweightSection = (logs: Array<{ date: string; weight: number }>) => {
  const lines = ['## Bodyweight Log', ''];
  if (!logs.length) {
    lines.push(NO_RECORDS);
    return lines.join('\n');
  }

  lines.push('| Date | Weight (kg) |');
  lines.push('|---|---|');
  for (const entry of sortByDateAscending(logs)) {
    lines.push(`| ${escapeCell(entry.date)} | ${formatNumber(entry.weight)} |`);
  }
  return lines.join('\n');
};

const buildBodyMeasurementSection = (logs: BodyMeasurementLog[]) => {
  const lines = ['## Body Measurements (cm)', ''];
  if (!logs.length) {
    lines.push(NO_RECORDS);
    return lines.join('\n');
  }

  lines.push(
    '| Date | Chest | Waist | Abdomen | Hips | Left Arm | Right Arm | Left Thigh | Right Thigh | Neck | Notes |'
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const log of sortByMeasurementDateAscending(logs)) {
    lines.push(
      `| ${escapeCell(log.measurementDate)} | ${formatNumber(log.chestCm)} | ${formatNumber(log.waistCm)} | ${formatNumber(log.abdomenCm)} | ${formatNumber(log.hipsCm)} | ${formatNumber(log.leftArmCm)} | ${formatNumber(log.rightArmCm)} | ${formatNumber(log.leftThighCm)} | ${formatNumber(log.rightThighCm)} | ${formatNumber(log.neckCm)} | ${escapeCell(formatOptional(log.notes))} |`
    );
  }
  return lines.join('\n');
};

const buildNutritionLogsSection = (logs: SavedNutritionLog[]) => {
  const lines = ['## Nutrition Logs', ''];
  if (!logs.length) {
    lines.push(NO_RECORDS);
    return lines.join('\n');
  }

  for (const log of sortNutritionLogs(logs)) {
    lines.push(`### ${log.date}`);
    lines.push(
      `- Totals: ${formatNumber(log.totalCalories, ' kcal')}, ${formatNumber(log.totalProteinGrams, ' g protein')}, ${formatNumber(log.totalCarbs, ' g carbs')}, ${formatNumber(log.totalFat, ' g fat')}`
    );
    if (log.rawInputText.trim()) {
      lines.push(`- Raw user input: ${escapeCell(log.rawInputText.trim())}`);
    }
    if (log.items.length === 0) {
      lines.push('- Items: none');
    } else {
      lines.push('- Items:');
      for (const item of log.items) {
        const calories = formatNumber(item.calories, ' kcal');
        const protein = formatNumber(item.proteinGrams, ' g protein');
        const carbs = formatNumber(item.carbs, ' g carbs');
        const fat = formatNumber(item.fat, ' g fat');
        const reason = item.reason ? ` — note: ${item.reason}` : '';
        lines.push(
          `  - ${item.displayName || item.originalText} [${item.status}] — ${calories}, ${protein}, ${carbs}, ${fat}${reason}`
        );
      }
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
};

const buildWorkoutSection = (sessions: SavedWorkoutSession[]) => {
  const lines = ['## Workout Sessions', ''];
  if (!sessions.length) {
    lines.push(NO_RECORDS);
    return lines.join('\n');
  }

  for (const session of sortWorkoutSessions(sessions)) {
    const dayLabel = session.dayName || session.dayId || '(unnamed day)';
    lines.push(`### ${session.date} — ${dayLabel}`);
    lines.push(`- Started at: ${formatOptional(session.startedAt)}`);
    lines.push(`- Ended at: ${formatOptional(session.endedAt)}`);
    lines.push(`- Duration: ${formatDuration(session.durationSeconds)}`);
    lines.push(`- Energy level: ${formatOptional(session.energyLevel)}`);
    lines.push(`- Reorder count: ${session.reorderCount}`);
    if (session.exercises.length === 0) {
      lines.push('- Exercises: none');
      lines.push('');
      continue;
    }
    lines.push('- Exercises:');
    for (const exercise of session.exercises) {
      const planned = [
        exercise.plannedSets ? `${exercise.plannedSets} sets` : '',
        exercise.plannedReps ? `${exercise.plannedReps} reps` : '',
        exercise.plannedWeight ? `@ ${exercise.plannedWeight}` : '',
      ]
        .filter(Boolean)
        .join(' x ');
      const plannedText = planned ? planned : '—';
      lines.push(`  - **${exercise.exerciseName || '(unnamed exercise)'}**`);
      lines.push(`    - Planned: ${plannedText}`);
      lines.push(`    - Completed: ${exercise.completed ? 'yes' : 'no'}`);
      lines.push(`    - Duration: ${formatDuration(exercise.durationSeconds || 0)}`);
      if (exercise.sets.length === 0) {
        lines.push('    - Sets: none');
      } else {
        lines.push('    - Sets:');
        exercise.sets.forEach((set, index) => {
          lines.push(
            `      - Set ${index + 1}: ${set.weight || '-'}kg x ${set.reps || '-'} reps, difficulty: ${set.difficulty || '-'}`
          );
        });
      }
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
};

const buildWeeklySnapshotsSection = (snapshots: WeeklyGoalSnapshot[]) => {
  const lines = ['## Weekly Goal Snapshots', ''];
  if (!snapshots.length) {
    lines.push(NO_RECORDS);
    return lines.join('\n');
  }

  for (const snapshot of sortWeeklySnapshots(snapshots)) {
    lines.push(`### Week ${snapshot.weekStartDate} → ${snapshot.weekEndDate}`);
    lines.push(`- Goal type: ${snapshot.goalType}`);
    lines.push(`- Title: ${formatOptional(snapshot.title)}`);
    if (snapshot.body && snapshot.body.trim()) {
      lines.push(`- Body: ${snapshot.body.replace(/\n/g, ' ')}`);
    }
    lines.push(`- Focus area: ${formatOptional(snapshot.focusArea)}`);
    lines.push(`- Primary metric: ${snapshot.primaryMetric || '-'}`);
    lines.push(`- Confidence: ${snapshot.confidence}`);
    lines.push(`- Targets: ${JSON.stringify(snapshot.targets || {})}`);
    lines.push(`- Actuals: ${JSON.stringify(snapshot.actuals || {})}`);
    lines.push(`- Outcomes: ${JSON.stringify(snapshot.outcomes || {})}`);
    lines.push(`- Finalized at: ${formatOptional(snapshot.finalizedAt)}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
};

export const renderUserFitnessExportMarkdown = (input: UserFitnessExportInput): string => {
  const sections = [
    buildHeader(input),
    buildProfileSection(input.profile),
    buildNutritionTargetsSection(input.nutritionTargets, input.profile),
    buildBodyweightSection(input.bodyweightLogs),
    buildBodyMeasurementSection(input.bodyMeasurementLogs),
    buildNutritionLogsSection(input.nutritionLogs),
    buildWorkoutSection(input.workoutSessions),
    buildWeeklySnapshotsSection(input.weeklyGoalSnapshots),
  ];

  return `${sections.join('\n\n')}\n`;
};
