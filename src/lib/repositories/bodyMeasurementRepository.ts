import { webSupabase } from '@/lib/supabase/browser';

type BodyMeasurementLogRow = {
  id: string;
  user_id: string;
  measurement_date: string;
  chest_cm: number | string | null;
  waist_cm: number | string | null;
  abdomen_cm: number | string | null;
  hips_cm: number | string | null;
  left_arm_cm: number | string | null;
  right_arm_cm: number | string | null;
  left_thigh_cm: number | string | null;
  right_thigh_cm: number | string | null;
  neck_cm: number | string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BodyMeasurementLog = {
  id: string;
  userId: string;
  measurementDate: string;
  chestCm: number | null;
  waistCm: number | null;
  abdomenCm: number | null;
  hipsCm: number | null;
  leftArmCm: number | null;
  rightArmCm: number | null;
  leftThighCm: number | null;
  rightThighCm: number | null;
  neckCm: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type BodyMeasurementLogFieldsInput = {
  measurementDate: string;
  chestCm?: number | string | null;
  waistCm?: number | string | null;
  abdomenCm?: number | string | null;
  hipsCm?: number | string | null;
  leftArmCm?: number | string | null;
  rightArmCm?: number | string | null;
  leftThighCm?: number | string | null;
  rightThighCm?: number | string | null;
  neckCm?: number | string | null;
  notes?: string | null;
};

export type CreateBodyMeasurementLogInput = BodyMeasurementLogFieldsInput;

export type UpdateBodyMeasurementLogInput = BodyMeasurementLogFieldsInput;

const requireCurrentUserId = async () => {
  const {
    data: { user },
    error,
  } = await webSupabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user?.id) {
    throw new Error('המשתמש לא מחובר.');
  }

  return user.id;
};

const parseOptionalPositiveDecimal = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('ערך מדידה חייב להיות מספר חיובי.');
  }

  return parsed;
};

const normalizeCreatePayload = (userId: string, input: CreateBodyMeasurementLogInput) => ({
  user_id: userId,
  measurement_date: String(input.measurementDate || '').trim(),
  chest_cm: parseOptionalPositiveDecimal(input.chestCm),
  waist_cm: parseOptionalPositiveDecimal(input.waistCm),
  abdomen_cm: parseOptionalPositiveDecimal(input.abdomenCm),
  hips_cm: parseOptionalPositiveDecimal(input.hipsCm),
  left_arm_cm: parseOptionalPositiveDecimal(input.leftArmCm),
  right_arm_cm: parseOptionalPositiveDecimal(input.rightArmCm),
  left_thigh_cm: parseOptionalPositiveDecimal(input.leftThighCm),
  right_thigh_cm: parseOptionalPositiveDecimal(input.rightThighCm),
  neck_cm: parseOptionalPositiveDecimal(input.neckCm),
  notes: input.notes ? String(input.notes).trim() : null,
});

const normalizeUpdatePayload = (input: UpdateBodyMeasurementLogInput) => ({
  measurement_date: String(input.measurementDate || '').trim(),
  chest_cm: parseOptionalPositiveDecimal(input.chestCm),
  waist_cm: parseOptionalPositiveDecimal(input.waistCm),
  abdomen_cm: parseOptionalPositiveDecimal(input.abdomenCm),
  hips_cm: parseOptionalPositiveDecimal(input.hipsCm),
  left_arm_cm: parseOptionalPositiveDecimal(input.leftArmCm),
  right_arm_cm: parseOptionalPositiveDecimal(input.rightArmCm),
  left_thigh_cm: parseOptionalPositiveDecimal(input.leftThighCm),
  right_thigh_cm: parseOptionalPositiveDecimal(input.rightThighCm),
  neck_cm: parseOptionalPositiveDecimal(input.neckCm),
  notes: input.notes ? String(input.notes).trim() : null,
});

const validateBodyMeasurementInput = (input: BodyMeasurementLogFieldsInput) => {
  const measurementDate = String(input.measurementDate || '').trim();

  if (!measurementDate) {
    throw new Error('חסר תאריך מדידה.');
  }

  const values = [
    input.chestCm,
    input.waistCm,
    input.abdomenCm,
    input.hipsCm,
    input.leftArmCm,
    input.rightArmCm,
    input.leftThighCm,
    input.rightThighCm,
    input.neckCm,
  ];

  if (!values.some((value) => value !== null && value !== undefined && value !== '')) {
    throw new Error('יש להזין לפחות מדידת היקף אחת.');
  }
};

const normalizeBodyMeasurementLog = (row: BodyMeasurementLogRow): BodyMeasurementLog => ({
  id: row.id,
  userId: row.user_id,
  measurementDate: row.measurement_date,
  chestCm: row.chest_cm != null ? Number(row.chest_cm) : null,
  waistCm: row.waist_cm != null ? Number(row.waist_cm) : null,
  abdomenCm: row.abdomen_cm != null ? Number(row.abdomen_cm) : null,
  hipsCm: row.hips_cm != null ? Number(row.hips_cm) : null,
  leftArmCm: row.left_arm_cm != null ? Number(row.left_arm_cm) : null,
  rightArmCm: row.right_arm_cm != null ? Number(row.right_arm_cm) : null,
  leftThighCm: row.left_thigh_cm != null ? Number(row.left_thigh_cm) : null,
  rightThighCm: row.right_thigh_cm != null ? Number(row.right_thigh_cm) : null,
  neckCm: row.neck_cm != null ? Number(row.neck_cm) : null,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const createBodyMeasurementLog = async (input: CreateBodyMeasurementLogInput) => {
  validateBodyMeasurementInput(input);

  const userId = await requireCurrentUserId();
  const { data, error } = await webSupabase
    .from('body_measurement_logs')
    .insert(normalizeCreatePayload(userId, input))
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return normalizeBodyMeasurementLog(data as BodyMeasurementLogRow);
};

export const updateBodyMeasurementLog = async (
  id: string,
  input: UpdateBodyMeasurementLogInput
) => {
  validateBodyMeasurementInput(input);

  const userId = await requireCurrentUserId();
  const { data, error } = await webSupabase
    .from('body_measurement_logs')
    .update(normalizeUpdatePayload(input))
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return normalizeBodyMeasurementLog(data as BodyMeasurementLogRow);
};

export const getLatestBodyMeasurementLog = async () => {
  const userId = await requireCurrentUserId();
  const { data, error } = await webSupabase
    .from('body_measurement_logs')
    .select('*')
    .eq('user_id', userId)
    .order('measurement_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeBodyMeasurementLog(data as BodyMeasurementLogRow) : null;
};

export const listBodyMeasurementLogs = async () => {
  const userId = await requireCurrentUserId();
  const { data, error } = await webSupabase
    .from('body_measurement_logs')
    .select('*')
    .eq('user_id', userId)
    .order('measurement_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => normalizeBodyMeasurementLog(row as BodyMeasurementLogRow));
};

export const deleteBodyMeasurementLog = async (id: string) => {
  const userId = await requireCurrentUserId();
  const { error } = await webSupabase
    .from('body_measurement_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
};
