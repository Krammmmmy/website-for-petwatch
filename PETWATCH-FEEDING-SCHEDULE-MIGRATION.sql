-- PetWatch schedule schema migration
-- Run this once in Supabase SQL Editor.
-- Keeps the existing feeding_schedules table and existing rows.

ALTER TABLE public.feeding_schedules
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Feeding routine',
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'Food',
  ADD COLUMN IF NOT EXISTS water_target_weight_g numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'Every Day',
  ADD COLUMN IF NOT EXISTS days text[] NOT NULL
    DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri','Sat','Sun']::text[],
  ADD COLUMN IF NOT EXISTS start_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS end_date date;

-- Keep the dashboard's supported values consistent with the ESP32 firmware.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'feeding_schedules_type_check'
      AND conrelid = 'public.feeding_schedules'::regclass
  ) THEN
    ALTER TABLE public.feeding_schedules
      ADD CONSTRAINT feeding_schedules_type_check
      CHECK (type IN ('Food', 'Water', 'Food & water'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'feeding_schedules_recurrence_check'
      AND conrelid = 'public.feeding_schedules'::regclass
  ) THEN
    ALTER TABLE public.feeding_schedules
      ADD CONSTRAINT feeding_schedules_recurrence_check
      CHECK (recurrence IN ('Once', 'Every Day', 'Weekdays', 'Weekends', 'Custom Days'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS feeding_schedules_enabled_time_idx
  ON public.feeding_schedules (enabled, schedule_time);
