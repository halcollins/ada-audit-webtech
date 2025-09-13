-- Create audit_submissions table
CREATE TABLE public.audit_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  url TEXT NOT NULL,
  audit_results JSONB,
  violations_count INTEGER DEFAULT 0,
  passes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.audit_submissions ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (anyone can submit audit requests)
CREATE POLICY "Allow public audit submissions" 
ON public.audit_submissions 
FOR INSERT 
WITH CHECK (true);

-- Allow authenticated users to view all submissions (for admin review)
CREATE POLICY "Authenticated users can view all submissions" 
ON public.audit_submissions 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_audit_submissions_updated_at
BEFORE UPDATE ON public.audit_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_audit_submissions_email ON public.audit_submissions(email);
CREATE INDEX idx_audit_submissions_created_at ON public.audit_submissions(created_at DESC);
CREATE INDEX idx_audit_submissions_url ON public.audit_submissions(url);