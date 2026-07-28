
-- 1) Lock down SECURITY DEFINER cleanup function
REVOKE ALL ON FUNCTION public.cleanup_old_audit_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_data() TO service_role;

-- 2) Replace permissive INSERT policies with validated checks
DROP POLICY IF EXISTS "Allow public insert on audit_submissions" ON public.audit_submissions;
CREATE POLICY "Allow public insert on audit_submissions"
ON public.audit_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(name)) BETWEEN 1 AND 200
  AND length(email) BETWEEN 3 AND 320
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(url) BETWEEN 1 AND 2048
  AND url ~* '^https?://'
);

DROP POLICY IF EXISTS "Allow public insert on audit_analytics" ON public.audit_analytics;
CREATE POLICY "Allow public insert on audit_analytics"
ON public.audit_analytics
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(event_type) BETWEEN 1 AND 100
  AND (url IS NULL OR length(url) <= 2048)
  AND (error_type IS NULL OR length(error_type) <= 200)
  AND (user_agent IS NULL OR length(user_agent) <= 1000)
  AND (referrer IS NULL OR length(referrer) <= 2048)
);
