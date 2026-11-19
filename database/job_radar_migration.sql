-- Kova — Job Radar & Individual Candidate Space Schema (Supabase PostgreSQL + RLS)

CREATE TABLE IF NOT EXISTS public.job_offers (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_label TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('ci_africa', 'tech_remote')),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  work_mode TEXT NOT NULL CHECK (work_mode IN ('remote', 'hybrid', 'onsite')),
  contract_type TEXT NOT NULL,
  experience_level TEXT NOT NULL,
  salary TEXT,
  skills TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at DATE NOT NULL DEFAULT CURRENT_DATE,
  language TEXT NOT NULL DEFAULT 'fr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_offers_market_published
  ON public.job_offers (market, published_at DESC);

CREATE TABLE IF NOT EXISTS public.candidate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  headline TEXT NOT NULL,
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  location TEXT NOT NULL DEFAULT 'Abidjan, Côte d''Ivoire',
  preferred_work_mode TEXT NOT NULL DEFAULT 'any',
  years_experience INTEGER NOT NULL DEFAULT 0,
  skills TEXT[] NOT NULL DEFAULT '{}',
  highlights TEXT[] NOT NULL DEFAULT '{}',
  languages TEXT[] NOT NULL DEFAULT '{Français}',
  raw_cv_text TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.candidate_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id TEXT NOT NULL,
  offer_title TEXT NOT NULL,
  company TEXT NOT NULL,
  source_label TEXT NOT NULL,
  offer_url TEXT NOT NULL,
  match_score INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  stage TEXT NOT NULL CHECK (stage IN ('saved', 'applied', 'interview', 'offer', 'rejected')),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, offer_id)
);

ALTER TABLE public.job_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_offers_public_read" ON public.job_offers;
CREATE POLICY "job_offers_public_read"
  ON public.job_offers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "candidate_profiles_own_all" ON public.candidate_profiles;
CREATE POLICY "candidate_profiles_own_all"
  ON public.candidate_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "candidate_applications_own_all" ON public.candidate_applications;
CREATE POLICY "candidate_applications_own_all"
  ON public.candidate_applications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
