-- ============================================================
-- SQL Migration: Setup AI Menu Config Table
-- Paste this script in your Supabase SQL Editor and click RUN.
-- ============================================================

-- 1. Create the app_config table
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- 3. Allow read access to authenticated users
CREATE POLICY "Allow read config to authenticated" ON public.app_config
  FOR SELECT TO authenticated USING (true);

-- 4. Insert the Gemini API key (using placeholder for git push safety)
INSERT INTO public.app_config (key, value)
VALUES ('gemini_api_key', 'YOUR_GEMINI_API_KEY_HERE')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
