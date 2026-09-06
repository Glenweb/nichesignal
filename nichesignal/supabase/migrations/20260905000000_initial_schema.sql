-- ============================================================
-- NicheSignal — Initial Schema
-- 2026-09-05
-- ============================================================

-- ── PROFILES (extends auth.users) ─────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text,
  plan       text DEFAULT 'agency', -- agency for now; future: free/starter/pro/agency
  created_at timestamptz DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── KEYWORD ANALYSES (shared cache) ──────────────────────
CREATE TABLE IF NOT EXISTS keyword_analyses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword             text NOT NULL,
  keyword_hash        text UNIQUE NOT NULL,  -- sha256 of lowercase-trimmed keyword
  demand_score        int CHECK (demand_score BETWEEN 0 AND 100),
  competition_score   int CHECK (competition_score BETWEEN 0 AND 100),
  money_score         int CHECK (money_score BETWEEN 0 AND 100),
  overall_score       int CHECK (overall_score BETWEEN 0 AND 100),
  verdict             text CHECK (verdict IN ('GO', 'INVESTIGATE', 'SKIP')),
  category            text,
  trend_direction     text CHECK (trend_direction IN ('rising', 'stable', 'falling')),
  search_volume       int,
  cpc                 numeric(6,2),
  avg_dr              int,
  amazon_commission   numeric(4,1),
  coach_text          text,
  content_angles      jsonb,  -- string[]
  affiliate_programmes jsonb, -- AffiliateResult[]
  raw_data            jsonb,  -- full API responses for debugging
  cached_at           timestamptz DEFAULT now(),
  expires_at          timestamptz DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_keyword_analyses_hash ON keyword_analyses(keyword_hash);
CREATE INDEX IF NOT EXISTS idx_keyword_analyses_expires ON keyword_analyses(expires_at);
CREATE INDEX IF NOT EXISTS idx_keyword_analyses_keyword ON keyword_analyses(lower(keyword));

-- ── PROJECTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

-- ── PROJECT ANALYSES (saved analyses per project) ─────────
CREATE TABLE IF NOT EXISTS project_analyses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  keyword     text NOT NULL,
  analysis_id uuid REFERENCES keyword_analyses(id) ON DELETE SET NULL,
  notes       text,
  starred     boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_analyses_project ON project_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_project_analyses_user ON project_analyses(user_id);

-- ── NICHE WATCH ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  keyword         text NOT NULL,
  last_score      int,
  last_verdict    text,
  alert_threshold int DEFAULT 10,  -- point delta that triggers notification
  last_checked_at timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_watches_user ON watches(user_id);

-- ── WATCH HISTORY ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watch_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id   uuid NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  score      int,
  verdict    text,
  delta      int,  -- score change from previous check (positive = improved)
  checked_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watch_history_watch ON watch_history(watch_id);

-- ── AFFILIATE PROGRAMME DATABASE ──────────────────────────
CREATE TABLE IF NOT EXISTS affiliate_programmes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  category        text NOT NULL,
  network         text,           -- Direct / Awin / CJ / Rakuten / ShareASale
  commission_rate text,           -- kept as text to allow ranges like "4–8%"
  type            text,           -- Physical / Service / Lead
  cookie_days     int,
  url             text,
  active          boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_programmes_category ON affiliate_programmes(category);

-- ── SEED: AFFILIATE PROGRAMMES ────────────────────────────
INSERT INTO affiliate_programmes (name, category, network, commission_rate, type) VALUES
  -- tech
  ('Amazon Associates',    'tech',    'Direct',    '4–8%',        'Physical'),
  ('Currys',               'tech',    'Awin',      '0.5–2%',      'Physical'),
  ('John Lewis',           'tech',    'Awin',      '2–3%',        'Physical'),
  ('Newegg',               'tech',    'CJ',        '1–5%',        'Physical'),
  ('B&H Photo',            'tech',    'Rakuten',   '5%',          'Physical'),
  -- health
  ('Amazon Associates',    'health',  'Direct',    '1–4.5%',      'Physical'),
  ('Holland & Barrett',    'health',  'Awin',      '8%',          'Physical'),
  ('Myprotein',            'health',  'Awin',      '10%',         'Physical'),
  ('iHerb',                'health',  'Direct',    '5%',          'Physical'),
  ('Chemist Direct',       'health',  'Awin',      '3%',          'Physical'),
  -- pet
  ('Amazon Associates',    'pet',     'Direct',    '8–10%',       'Physical'),
  ('Pets at Home',         'pet',     'Awin',      '5%',          'Physical'),
  ('Chewy',                'pet',     'CJ',        '4%',          'Physical'),
  ('VioVet',               'pet',     'Awin',      '10%',         'Physical'),
  ('PetPlan Insurance',    'pet',     'Direct',    '20–30%',      'Service'),
  -- sports
  ('Amazon Associates',    'sports',  'Direct',    '4–8%',        'Physical'),
  ('Wiggle',               'sports',  'Awin',      '6%',          'Physical'),
  ('Decathlon',            'sports',  'Awin',      '5%',          'Physical'),
  ('ProBikeKit',           'sports',  'Awin',      '6%',          'Physical'),
  ('Go Outdoors',          'sports',  'Awin',      '5%',          'Physical'),
  -- home
  ('Amazon Associates',    'home',    'Direct',    '3–8%',        'Physical'),
  ('AO.com',               'home',    'Awin',      '2%',          'Physical'),
  ('Wayfair',              'home',    'CJ',        '7%',          'Physical'),
  ('John Lewis',           'home',    'Awin',      '2%',          'Physical'),
  ('IKEA',                 'home',    'Awin',      '5%',          'Physical'),
  -- baby
  ('Amazon Associates',    'baby',    'Direct',    '4–4.5%',      'Physical'),
  ('Mothercare',           'baby',    'Awin',      '6%',          'Physical'),
  ('Boots',                'baby',    'Awin',      '3%',          'Physical'),
  ('JoJo Maman Bébé',      'baby',    'Awin',      '8%',          'Physical'),
  ('Kidly',                'baby',    'Awin',      '12%',         'Physical'),
  -- travel
  ('Booking.com',          'travel',  'Direct',    '25–40% rev',  'Service'),
  ('Hotels.com',           'travel',  'CJ',        '4%',          'Service'),
  ('Viator',               'travel',  'CJ',        '8%',          'Service'),
  ('World Nomads',         'travel',  'CJ',        '10%',         'Service'),
  ('TripAdvisor',          'travel',  'CJ',        'Varies',      'Service'),
  -- finance
  ('MoneySupermarket',     'finance', 'Direct',    '£20–40 CPA',  'Lead'),
  ('Compare the Market',   'finance', 'Direct',    '£15–35 CPA',  'Lead'),
  ('Experian',             'finance', 'Awin',      '£20 CPA',     'Lead'),
  ('AJ Bell',              'finance', 'Direct',    '£100–200 CPA','Lead'),
  ('Interactive Investor', 'finance', 'Direct',    '£75 CPA',     'Lead'),
  -- beauty
  ('Amazon Associates',    'beauty',  'Direct',    '4–10%',       'Physical'),
  ('Lookfantastic',        'beauty',  'Awin',      '8%',          'Physical'),
  ('Cult Beauty',          'beauty',  'Awin',      '6%',          'Physical'),
  ('SEPHORA',              'beauty',  'Rakuten',   '5%',          'Physical'),
  ('Charlotte Tilbury',    'beauty',  'Awin',      '10%',         'Physical'),
  -- general
  ('Amazon Associates',    'general', 'Direct',    '4–8%',        'Physical'),
  ('eBay Partner Network', 'general', 'Direct',    '1–4%',        'Physical'),
  ('ShareASale',           'general', 'ShareASale','Varies',      'Various'),
  ('Awin marketplace',     'general', 'Awin',      'Varies',      'Various'),
  ('CJ Affiliate',         'general', 'CJ',        'Varies',      'Various')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_analyses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_analyses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE watches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_programmes ENABLE ROW LEVEL SECURITY;

-- profiles: own row only
CREATE POLICY "profiles: read own"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: update own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- keyword_analyses: all authenticated users can read (shared cache)
-- writes are service-role only (no user policy = anon/user cannot insert/update)
CREATE POLICY "analyses: authenticated read" ON keyword_analyses
  FOR SELECT USING (auth.role() = 'authenticated');

-- projects: own rows only
CREATE POLICY "projects: read own"   ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects: insert own" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects: update own" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "projects: delete own" ON projects FOR DELETE USING (auth.uid() = user_id);

-- project_analyses: own rows only
CREATE POLICY "proj_analyses: read own"   ON project_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "proj_analyses: insert own" ON project_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "proj_analyses: update own" ON project_analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "proj_analyses: delete own" ON project_analyses FOR DELETE USING (auth.uid() = user_id);

-- watches: own rows only
CREATE POLICY "watches: read own"   ON watches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watches: insert own" ON watches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watches: update own" ON watches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "watches: delete own" ON watches FOR DELETE USING (auth.uid() = user_id);

-- watch_history: readable if you own the parent watch
CREATE POLICY "watch_history: read own" ON watch_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM watches w
    WHERE w.id = watch_history.watch_id AND w.user_id = auth.uid()
  ));

-- affiliate_programmes: readable by all authenticated, no user writes
CREATE POLICY "affiliate_progs: authenticated read" ON affiliate_programmes
  FOR SELECT USING (auth.role() = 'authenticated');
