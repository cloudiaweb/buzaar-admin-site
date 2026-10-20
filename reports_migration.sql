-- The reports table already exists with 'reported_by' instead of 'reporter_id'.
-- This script adds any missing columns and sets up RLS policies.

-- Add missing columns if they don't exist yet
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS details      TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS admin_note   TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolved_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolved_at  TIMESTAMPTZ;

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist before recreating
DROP POLICY IF EXISTS "reports_insert_authenticated" ON public.reports;
DROP POLICY IF EXISTS "reports_select_own"           ON public.reports;
DROP POLICY IF EXISTS "reports_admin_select"         ON public.reports;
DROP POLICY IF EXISTS "reports_admin_update"         ON public.reports;

-- Any authenticated user can submit a report
CREATE POLICY "reports_insert_authenticated"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (reported_by = auth.uid());

-- Users can read their own submitted reports
CREATE POLICY "reports_select_own"
  ON public.reports FOR SELECT
  TO authenticated
  USING (reported_by = auth.uid());

-- Admins can read all reports
CREATE POLICY "reports_admin_select"
  ON public.reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can update reports (resolve/dismiss)
CREATE POLICY "reports_admin_update"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Indexes
CREATE INDEX IF NOT EXISTS reports_status_idx     ON public.reports (status);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON public.reports (created_at DESC);
CREATE INDEX IF NOT EXISTS reports_reported_by_idx ON public.reports (reported_by);
