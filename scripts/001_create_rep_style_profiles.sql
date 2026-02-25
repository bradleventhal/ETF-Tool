-- Rep style profiles for Follow Up Generator
CREATE TABLE IF NOT EXISTS public.rep_style_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_name TEXT UNIQUE NOT NULL,
  style_examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  style_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS needed - internal tool, no user auth
-- Insert default rows for Brad and Bernie
INSERT INTO public.rep_style_profiles (rep_name, style_examples, style_summary)
VALUES
  ('Brad', '[]'::jsonb, NULL),
  ('Bernie', '[]'::jsonb, NULL)
ON CONFLICT (rep_name) DO NOTHING;
