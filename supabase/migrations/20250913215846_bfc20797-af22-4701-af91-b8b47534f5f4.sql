-- Add data retention policy and analytics table

-- Create function to automatically delete old audit submissions (30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_submissions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.audit_submissions 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create analytics table to track audit attempts and patterns
CREATE TABLE public.audit_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'attempt', 'success', 'failure'
  url TEXT,
  error_type TEXT, -- CORS, invalid_url, timeout, etc.
  user_agent TEXT,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on analytics table
ALTER TABLE public.audit_analytics ENABLE ROW LEVEL SECURITY;

-- Allow public inserts for analytics (no personal data stored)
CREATE POLICY "Allow public analytics inserts" 
ON public.audit_analytics 
FOR INSERT 
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_audit_analytics_event_type ON public.audit_analytics(event_type);
CREATE INDEX idx_audit_analytics_created_at ON public.audit_analytics(created_at);
CREATE INDEX idx_audit_analytics_url ON public.audit_analytics(url);

-- Schedule automatic cleanup (if pg_cron is available)
-- This will run daily at 2 AM to clean up old submissions
-- Note: pg_cron extension needs to be enabled in Supabase
DO $$
BEGIN
  -- Only create the cron job if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-old-audit-submissions',
      '0 2 * * *', -- Daily at 2 AM
      'SELECT public.cleanup_old_audit_submissions();'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore if pg_cron is not available
    NULL;
END $$;