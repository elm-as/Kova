-- ==============================================
-- MIGRATION SUPABASE — AI Recruitment Score ATS
-- ==============================================
-- À exécuter dans Supabase SQL Editor
-- Projet : https://epzwsjzrcrosymnvutor.supabase.co
--
-- Tables :
--   companies, users, positions, candidates,
--   ordering_presets, payment_history, payment_reminders,
--   kv_store, cv_candidates (stockage OCR backend)
--
-- Politiques RLS : accès complet via clé publishable (MVP).
-- En production, restreindre par company_id via JWT.
-- ==============================================

BEGIN;

-- =====================
-- NETTOYAGE (si réexécution)
-- =====================
DROP TABLE IF EXISTS public.cv_candidates CASCADE;
DROP TABLE IF EXISTS public.payment_reminders CASCADE;
DROP TABLE IF EXISTS public.payment_history CASCADE;
DROP TABLE IF EXISTS public.ordering_presets CASCADE;
DROP TABLE IF EXISTS public.candidates CASCADE;
DROP TABLE IF EXISTS public.positions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;
DROP TABLE IF EXISTS public.kv_store CASCADE;

-- =====================
-- FONCTION UTILITAIRE
-- =====================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================
-- TABLE: companies
-- =====================
CREATE TABLE public.companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,

  -- Licence
  license_type TEXT NOT NULL DEFAULT 'trial'
    CHECK (license_type IN ('trial','starter','professional','enterprise')),
  max_users INT NOT NULL DEFAULT 3,
  max_positions INT NOT NULL DEFAULT 5,
  max_candidates_per_position INT NOT NULL DEFAULT 50,
  features JSONB NOT NULL DEFAULT '{
    "bulkOperations":false,
    "advancedAnalytics":false,
    "emailTemplates":false,
    "apiAccess":false,
    "customBranding":false
  }',
  license_start_date BIGINT NOT NULL,
  license_expiry_date BIGINT NOT NULL,
  license_is_active BOOLEAN NOT NULL DEFAULT true,

  -- Abonnement / Stripe
  subscription_status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (subscription_status IN ('active','past_due','canceled','expired','trialing')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end BIGINT,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  last_payment_date BIGINT,
  next_payment_date BIGINT,
  payment_method JSONB,

  -- Target level par défaut (pour scoring IA)
  target_level TEXT DEFAULT 'mid'
    CHECK (target_level IN ('junior','mid','senior')),

  created_at BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================
-- TABLE: users
-- =====================
CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'recruiter'
    CHECK (role IN ('owner','admin','recruiter','viewer')),
  last_login_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_company_id ON public.users(company_id);
CREATE INDEX idx_users_email ON public.users(email);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================
-- TABLE: positions
-- =====================
CREATE TABLE public.positions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  requirements TEXT NOT NULL DEFAULT '',
  openings INT NOT NULL DEFAULT 1 CHECK (openings >= 0),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','closed','archived')),
  is_internship BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  target_level TEXT DEFAULT 'mid'
    CHECK (target_level IN ('junior','mid','senior')),
  hired_count INT NOT NULL DEFAULT 0,
  archived_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_positions_company_id ON public.positions(company_id);
CREATE INDEX idx_positions_status ON public.positions(status);

CREATE TRIGGER trg_positions_updated_at
BEFORE UPDATE ON public.positions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================
-- TABLE: candidates
-- =====================
CREATE TABLE public.candidates (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,

  -- Identité
  name TEXT NOT NULL,
  email TEXT NOT NULL,

  -- Contenu du CV
  profile_text TEXT NOT NULL DEFAULT '',
  file_name TEXT,
  file_type TEXT CHECK (
    file_type IS NULL OR
    file_type IN ('pdf','html','docx','image','txt')
  ),

  -- Classification OCR (ajouté v2)
  document_type TEXT,
  document_language TEXT,

  -- Scoring
  score INT NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  score_breakdown JSONB NOT NULL DEFAULT '[]',
  strengths JSONB NOT NULL DEFAULT '[]',
  weaknesses JSONB NOT NULL DEFAULT '[]',
  overall_assessment TEXT NOT NULL DEFAULT '',

  -- Défense anti-reverse-prompting (ajouté v2)
  prompt_defense JSONB,

  -- Entretiens
  interview_questions JSONB NOT NULL DEFAULT '[]',
  question_answers JSONB NOT NULL DEFAULT '[]',
  follow_up_questions JSONB NOT NULL DEFAULT '[]',

  -- Positions alternatives
  alternative_positions JSONB NOT NULL DEFAULT '[]',

  -- Statut
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','analyzing','scored','selected','rejected','hired')),
  custom_order INT,
  analyzed_at BIGINT,
  hired_at BIGINT,
  created_at BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidates_position_id ON public.candidates(position_id);
CREATE INDEX idx_candidates_status ON public.candidates(status);
CREATE INDEX idx_candidates_score ON public.candidates(score DESC);

CREATE TRIGGER trg_candidates_updated_at
BEFORE UPDATE ON public.candidates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================
-- TABLE: ordering_presets
-- =====================
CREATE TABLE public.ordering_presets (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  candidate_order JSONB NOT NULL DEFAULT '[]',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_ordering_presets_position_id ON public.ordering_presets(position_id);

-- =====================
-- TABLE: payment_history
-- =====================
CREATE TABLE public.payment_history (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL CHECK (status IN ('succeeded','failed','pending','refunded')),
  stripe_payment_id TEXT,
  description TEXT DEFAULT '',
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_payment_history_company_id ON public.payment_history(company_id);

-- =====================
-- TABLE: payment_reminders
-- =====================
CREATE TABLE public.payment_reminders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('upcoming','overdue','expiring_soon')),
  sent_at BIGINT NOT NULL,
  days_before_expiry INT NOT NULL DEFAULT 0,
  acknowledged BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_payment_reminders_company_id ON public.payment_reminders(company_id);

-- =====================
-- TABLE: kv_store (persistance générique)
-- =====================
CREATE TABLE public.kv_store (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::BIGINT,
  updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::BIGINT
);

-- =====================
-- TABLE: cv_candidates (stockage OCR backend Python)
-- =====================
-- Utilisée par le backend PaddleOCR pour stocker les résultats
-- structurés après extraction. Optionnelle — le backend fonctionne
-- sans cette table si SUPABASE_URL n'est pas défini.
CREATE TABLE public.cv_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT,
  raw_text TEXT,
  structured_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================
-- RLS (Row Level Security)
-- =====================
-- MVP : accès complet via clé publishable (anon) et authenticated.
-- En production, restreindre par company_id via JWT claims.

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordering_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kv_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_candidates ENABLE ROW LEVEL SECURITY;

-- Politiques anon + authenticated (MVP) → à remplacer par JWT en production
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'companies','users','positions','candidates',
    'ordering_presets','payment_history','payment_reminders',
    'kv_store','cv_candidates'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_rw_%s" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "anon_rw_%s" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)',
      tbl, tbl
    );
    EXECUTE format('DROP POLICY IF EXISTS "auth_rw_%s" ON public.%I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY "auth_rw_%s" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      tbl, tbl
    );
  END LOOP;
END $$;

-- =====================
-- STORAGE BUCKET (pour CV uploads, optionnel)
-- =====================
-- À exécuter dans l'onglet "Storage" du dashboard Supabase
-- ou via SQL si l'extension storage est activée :
--
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'cvs',
--   'cvs',
--   false,
--   5242880,  -- 5 Mo
--   ARRAY['application/pdf','image/png','image/jpeg','image/webp']
-- );
--
-- Politique storage : accès authenticated uniquement
-- CREATE POLICY "auth_access_cvs"
-- ON storage.objects FOR ALL TO authenticated
-- USING (bucket_id = 'cvs') WITH CHECK (bucket_id = 'cvs');

COMMIT;
