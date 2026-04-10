alter table public.body_measurement_logs
  add column if not exists neck_cm numeric null;

alter table public.body_measurement_logs
  drop constraint if exists body_measurement_logs_neck_cm_positive_check;

alter table public.body_measurement_logs
  add constraint body_measurement_logs_neck_cm_positive_check
    check (neck_cm is null or neck_cm > 0);

alter table public.body_measurement_logs
  drop constraint if exists body_measurement_logs_at_least_one_value_check;

alter table public.body_measurement_logs
  add constraint body_measurement_logs_at_least_one_value_check
    check (
      chest_cm is not null
      or waist_cm is not null
      or abdomen_cm is not null
      or hips_cm is not null
      or left_arm_cm is not null
      or right_arm_cm is not null
      or left_thigh_cm is not null
      or right_thigh_cm is not null
      or neck_cm is not null
    );
