import type { BodyMeasurementLog } from '@/lib/repositories/bodyMeasurementRepository';
import type { WorkoutProgramDay } from '@/lib/repositories/programRepository';

export const createEmptyRow = () => ({
  id: '',
  exercise: '',
  sets: '',
  repsHeavy: '',
  weightHeavy: '',
});

export const createEmptyDay = () => ({
  id: '',
  name: '',
  rows: [createEmptyRow()],
});

export const normalizeEditableProgramDays = (days: WorkoutProgramDay[] = []) =>
  Array.isArray(days) && days.length > 0
    ? days.map((day) => ({
        id: day.id || '',
        name: day.name || '',
        rows:
          Array.isArray(day.rows) && day.rows.length > 0
            ? day.rows.map((row) => ({
                id: row.id || '',
                exercise: row.exercise || '',
                sets: row.sets || '',
                repsHeavy: row.repsHeavy || '',
                weightHeavy: row.weightHeavy || '',
              }))
            : [createEmptyRow()],
      }))
    : [createEmptyDay()];

export const parseCommaList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const createEmptyMeasurementForm = () => ({
  measurementDate: new Date().toISOString().slice(0, 10),
  chestCm: '',
  waistCm: '',
  abdomenCm: '',
  hipsCm: '',
  leftArmCm: '',
  rightArmCm: '',
  leftThighCm: '',
  rightThighCm: '',
  neckCm: '',
  notes: '',
});

export const formatMeasurementValue = (value: number | null) => (value != null ? `${value} ס"מ` : '—');

export const getFilledMeasurementValues = (measurement: BodyMeasurementLog) =>
  [
    measurement.chestCm != null ? `חזה (קו פטמות) ${measurement.chestCm} ס"מ` : null,
    measurement.waistCm != null ? `מותן (האזור הצר ביותר) ${measurement.waistCm} ס"מ` : null,
    measurement.abdomenCm != null ? `בטן (קו טבור) ${measurement.abdomenCm} ס"מ` : null,
    measurement.hipsCm != null ? `אגן (החלק הרחב ביותר) ${measurement.hipsCm} ס"מ` : null,
    measurement.leftArmCm != null ? `יד שמאל (רפויה כלפי מטה) ${measurement.leftArmCm} ס"מ` : null,
    measurement.rightArmCm != null ? `יד ימין (רפויה כלפי מטה) ${measurement.rightArmCm} ס"מ` : null,
    measurement.leftThighCm != null ? `ירך שמאל (האמצע) ${measurement.leftThighCm} ס"מ` : null,
    measurement.rightThighCm != null ? `ירך ימין (האמצע) ${measurement.rightThighCm} ס"מ` : null,
    measurement.neckCm != null ? `צוואר (מתחת לגרוגרת) ${measurement.neckCm} ס"מ` : null,
  ].filter(Boolean) as string[];

export const measurementToFormValues = (measurement: BodyMeasurementLog) => ({
  measurementDate: measurement.measurementDate,
  chestCm: measurement.chestCm != null ? String(measurement.chestCm) : '',
  waistCm: measurement.waistCm != null ? String(measurement.waistCm) : '',
  abdomenCm: measurement.abdomenCm != null ? String(measurement.abdomenCm) : '',
  hipsCm: measurement.hipsCm != null ? String(measurement.hipsCm) : '',
  leftArmCm: measurement.leftArmCm != null ? String(measurement.leftArmCm) : '',
  rightArmCm: measurement.rightArmCm != null ? String(measurement.rightArmCm) : '',
  leftThighCm: measurement.leftThighCm != null ? String(measurement.leftThighCm) : '',
  rightThighCm: measurement.rightThighCm != null ? String(measurement.rightThighCm) : '',
  neckCm: measurement.neckCm != null ? String(measurement.neckCm) : '',
  notes: measurement.notes || '',
});
