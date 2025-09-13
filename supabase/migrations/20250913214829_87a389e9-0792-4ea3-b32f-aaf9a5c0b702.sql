-- Fix security vulnerability: Remove policy that exposes all email addresses to authenticated users
-- This policy allowed any authenticated user to view all audit submissions including email addresses
DROP POLICY IF EXISTS "Authenticated users can view all submissions" ON public.audit_submissions;

-- Note: The public audit tool doesn't require user access to view other submissions
-- If admin access is needed in the future, create a specific admin role-based policy instead
-- Example for future admin access (commented out):
-- CREATE POLICY "Admin users can view all submissions" 
-- ON public.audit_submissions 
-- FOR SELECT 
-- USING (
--   EXISTS (
--     SELECT 1 FROM public.user_profiles 
--     WHERE user_id = auth.uid() AND role = 'admin'
--   )
-- );