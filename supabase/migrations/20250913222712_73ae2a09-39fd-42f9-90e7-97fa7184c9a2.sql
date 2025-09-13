-- Fix security vulnerability: Prevent public access to customer email addresses
-- Add RLS policy to completely block SELECT access to audit_submissions table
-- This ensures email addresses and audit results remain private

CREATE POLICY "Block all public access to audit submissions" 
ON public.audit_submissions 
FOR SELECT 
USING (false);

-- Also secure the analytics table while we're at it
CREATE POLICY "Block all public access to audit analytics" 
ON public.audit_analytics 
FOR SELECT 
USING (false);