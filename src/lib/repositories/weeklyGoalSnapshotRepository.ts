import { webSupabase } from '@/lib/supabase/browser';
import type {
  CreateWeeklyGoalSnapshotInput,
  UpdateWeeklyGoalSnapshotInput,
  WeeklyGoalActuals,
  WeeklyGoalOutcomes,
  WeeklyGoalSnapshot,
  WeeklyGoalTargets,
} from '@/lib/weeklyGoalSnapshots';

type WeeklyGoalSnapshotRow = {
  id: string;
  user_id: string;
  week_start_date: string;
  week_end_date: string;
  goal_type: WeeklyGoalSnapshot['goalType'];
  template_id: string | null;
  title: string;
  body: string;
  focus_area: string | null;
  primary_metric: WeeklyGoalSnapshot['primaryMetric'];
  targets: WeeklyGoalTargets | null;
  actuals: WeeklyGoalActuals | null;
  outcomes: WeeklyGoalOutcomes | null;
  confidence: WeeklyGoalSnapshot['confidence'];
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
};

const normalizeSnapshot = (row: WeeklyGoalSnapshotRow): WeeklyGoalSnapshot => ({
  id: row.id,
  userId: row.user_id,
  weekStartDate: row.week_start_date,
  weekEndDate: row.week_end_date,
  goalType: row.goal_type,
  templateId: row.template_id,
  title: row.title,
  body: row.body,
  focusArea: row.focus_area,
  primaryMetric: row.primary_metric,
  targets: row.targets ?? {},
  actuals: row.actuals ?? {},
  outcomes: row.outcomes ?? {},
  confidence: row.confidence,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  finalizedAt: row.finalized_at,
});

const toInsertPayload = (input: CreateWeeklyGoalSnapshotInput) => ({
  user_id: input.userId,
  week_start_date: input.weekStartDate,
  week_end_date: input.weekEndDate,
  goal_type: input.goalType,
  template_id: input.templateId,
  title: input.title,
  body: input.body,
  focus_area: input.focusArea,
  primary_metric: input.primaryMetric,
  targets: input.targets,
  actuals: input.actuals,
  outcomes: input.outcomes,
  confidence: input.confidence,
});

const toUpdatePayload = (input: UpdateWeeklyGoalSnapshotInput) => {
  const payload: Record<string, unknown> = {};

  if (input.goalType !== undefined) payload.goal_type = input.goalType;
  if (input.templateId !== undefined) payload.template_id = input.templateId;
  if (input.title !== undefined) payload.title = input.title;
  if (input.body !== undefined) payload.body = input.body;
  if (input.focusArea !== undefined) payload.focus_area = input.focusArea;
  if (input.primaryMetric !== undefined) payload.primary_metric = input.primaryMetric;
  if (input.targets !== undefined) payload.targets = input.targets;
  if (input.actuals !== undefined) payload.actuals = input.actuals;
  if (input.outcomes !== undefined) payload.outcomes = input.outcomes;
  if (input.confidence !== undefined) payload.confidence = input.confidence;
  if (input.finalizedAt !== undefined) payload.finalized_at = input.finalizedAt;

  return payload;
};

export const findWeeklyGoalSnapshotByUserAndWeekStart = async (
  userId: string,
  weekStartDate: string
) => {
  const { data, error } = await webSupabase
    .from('weekly_goal_snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start_date', weekStartDate)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeSnapshot(data as WeeklyGoalSnapshotRow) : null;
};

export const findPendingWeeklyGoalSnapshotsBeforeWeekStart = async (
  userId: string,
  currentWeekStartDate: string
) => {
  const { data, error } = await webSupabase
    .from('weekly_goal_snapshots')
    .select('*')
    .eq('user_id', userId)
    .is('finalized_at', null)
    .lt('week_start_date', currentWeekStartDate)
    .order('week_start_date', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => normalizeSnapshot(row as WeeklyGoalSnapshotRow));
};

export const createWeeklyGoalSnapshot = async (input: CreateWeeklyGoalSnapshotInput) => {
  const { data, error } = await webSupabase
    .from('weekly_goal_snapshots')
    .insert(toInsertPayload(input))
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return normalizeSnapshot(data as WeeklyGoalSnapshotRow);
};

export const updateWeeklyGoalSnapshot = async (
  snapshotId: string,
  input: UpdateWeeklyGoalSnapshotInput
) => {
  const { data, error } = await webSupabase
    .from('weekly_goal_snapshots')
    .update(toUpdatePayload(input))
    .eq('id', snapshotId)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return normalizeSnapshot(data as WeeklyGoalSnapshotRow);
};

export const finalizeWeeklyGoalSnapshot = async (
  snapshotId: string,
  input: Pick<UpdateWeeklyGoalSnapshotInput, 'actuals' | 'outcomes' | 'finalizedAt'>
) => updateWeeklyGoalSnapshot(snapshotId, input);
