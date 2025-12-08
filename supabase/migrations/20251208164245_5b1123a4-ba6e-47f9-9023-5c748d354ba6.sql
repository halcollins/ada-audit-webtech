-- Create audit_submissions table for storing audit results
CREATE TABLE public.audit_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  url TEXT NOT NULL,
  audit_results JSONB,
  violations_count INTEGER DEFAULT 0,
  passes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.audit_submissions ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (for form submissions)
CREATE POLICY "Allow public insert on audit_submissions"
ON public.audit_submissions
FOR INSERT
WITH CHECK (true);

-- Block all reads (protect customer data)
CREATE POLICY "Block all reads on audit_submissions"
ON public.audit_submissions
FOR SELECT
USING (false);

-- Create audit_analytics table for tracking and rate limiting
CREATE TABLE public.audit_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  url TEXT,
  error_type TEXT,
  user_agent TEXT,
  referrer TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.audit_analytics ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (for analytics tracking)
CREATE POLICY "Allow public insert on audit_analytics"
ON public.audit_analytics
FOR INSERT
WITH CHECK (true);

-- Block all reads from public API
CREATE POLICY "Block public reads on audit_analytics"
ON public.audit_analytics
FOR SELECT
USING (false);

-- Create index for rate limiting queries
CREATE INDEX idx_audit_analytics_ip_created ON public.audit_analytics(ip_address, created_at);

-- Create index for analytics queries
CREATE INDEX idx_audit_analytics_event_type ON public.audit_analytics(event_type, created_at);

-- Auto-delete old submissions after 30 days (data retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.audit_submissions WHERE created_at < now() - INTERVAL '30 days';
  DELETE FROM public.audit_analytics WHERE created_at < now() - INTERVAL '30 days';
END;
$$;