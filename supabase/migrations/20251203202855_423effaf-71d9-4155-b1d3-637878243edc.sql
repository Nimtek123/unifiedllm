-- Create enum for permissions
CREATE TYPE public.user_permission AS ENUM ('upload', 'view', 'delete', 'manage_users');

-- Create sub_users table for team management
CREATE TABLE public.sub_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  permissions user_permission[] DEFAULT ARRAY['view']::user_permission[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(parent_user_id, email)
);

-- Enable RLS
ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;

-- Create security definer function for checking parent user
CREATE OR REPLACE FUNCTION public.is_parent_user(_user_id uuid, _parent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = _parent_id
$$;

-- Policies: Parent users can manage their sub-users
CREATE POLICY "Users can view their sub-users"
ON public.sub_users
FOR SELECT
USING (auth.uid() = parent_user_id);

CREATE POLICY "Users can create sub-users"
ON public.sub_users
FOR INSERT
WITH CHECK (auth.uid() = parent_user_id);

CREATE POLICY "Users can update their sub-users"
ON public.sub_users
FOR UPDATE
USING (auth.uid() = parent_user_id);

CREATE POLICY "Users can delete their sub-users"
ON public.sub_users
FOR DELETE
USING (auth.uid() = parent_user_id);

-- Trigger for updated_at
CREATE TRIGGER update_sub_users_updated_at
BEFORE UPDATE ON public.sub_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();