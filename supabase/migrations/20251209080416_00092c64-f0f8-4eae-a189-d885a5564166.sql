-- Create llm_list table for storing LLM assignments
CREATE TABLE public.llm_list (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    llm_id TEXT NOT NULL,
    llm_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.llm_list ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own LLMs
CREATE POLICY "Users can view their own LLMs"
ON public.llm_list
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can view LLMs assigned to them (for sub-users querying parent's LLMs)
CREATE POLICY "Admins can manage all LLMs"
ON public.llm_list
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
    )
);

-- Create index for faster lookups
CREATE INDEX idx_llm_list_user_id ON public.llm_list(user_id);