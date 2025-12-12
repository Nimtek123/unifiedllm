-- Create password_reset_codes table to store reset codes
CREATE TABLE public.password_reset_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  security_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '15 minutes'),
  used BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Allow public insert (for forgot password requests)
CREATE POLICY "Anyone can request password reset"
ON public.password_reset_codes
FOR INSERT
WITH CHECK (true);

-- Allow public select for code verification
CREATE POLICY "Anyone can verify their code"
ON public.password_reset_codes
FOR SELECT
USING (true);

-- Allow public update to mark code as used
CREATE POLICY "Anyone can mark code as used"
ON public.password_reset_codes
FOR UPDATE
USING (true);