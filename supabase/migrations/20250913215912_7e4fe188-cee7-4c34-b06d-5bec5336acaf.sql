-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_submissions()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.audit_submissions 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;