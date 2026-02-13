-- Add notified_at column to assignments table to track when proctors are notified
ALTER TABLE public.assignments 
ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
