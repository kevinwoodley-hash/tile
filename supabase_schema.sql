-- TileIQ Pro – Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- ── JOBS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
    id          text        PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    data        jsonb       NOT NULL,
    updated_at  timestamptz DEFAULT now()
);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jobs_owner ON jobs;
CREATE POLICY jobs_owner ON jobs
    USING  (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ── SETTINGS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    data        jsonb       NOT NULL,
    updated_at  timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settings_owner ON settings;
CREATE POLICY settings_owner ON settings
    USING  (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
