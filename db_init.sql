-- ============================================================
-- Civic Issue Reporting System – Database Init Script
-- Run: psql -U postgres -d civic_db -f db_init.sql
-- (create the database first: CREATE DATABASE civic_db;)
-- ============================================================

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- Users Table
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(150) UNIQUE NOT NULL,
    hashed_password VARCHAR(256) NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Issues Table  (canonical civic issue, de-duplicated)
-- ============================================================
CREATE TABLE IF NOT EXISTS issues (
    id          SERIAL PRIMARY KEY,
    type        VARCHAR(50) NOT NULL DEFAULT 'other',   -- pothole | garbage | streetlight | other
    status      VARCHAR(30) NOT NULL DEFAULT 'active',  -- active | resolved
    location    GEOGRAPHY(POINT, 4326),                 -- PostGIS geographic point
    address     TEXT,
    report_count INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issues_location ON issues USING GIST (location);

-- ============================================================
-- Reports Table  (one report per user submission)
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
    id          SERIAL PRIMARY KEY,
    issue_id    INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    image_url   TEXT,
    description TEXT,
    latitude    DOUBLE PRECISION,
    longitude   DOUBLE PRECISION,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_issue_id ON reports(issue_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id  ON reports(user_id);

-- ============================================================
-- Trigger: auto-update issues.updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_issues_updated_at ON issues;
CREATE TRIGGER trg_issues_updated_at
    BEFORE UPDATE ON issues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Seed Data (optional – a few sample issues in Hyderabad)
-- ============================================================
INSERT INTO users (name, email, hashed_password) VALUES
    ('Demo User', 'demo@civic.app', '$2b$12$demohashedpassword00000000000000000000000000000000000')
ON CONFLICT (email) DO NOTHING;

INSERT INTO issues (type, status, location, address, report_count) VALUES
    ('pothole',     'active', ST_GeographyFromText('POINT(78.4867 17.3850)'), 'Banjara Hills, Hyderabad', 3),
    ('garbage',     'active', ST_GeographyFromText('POINT(78.4744 17.3660)'), 'Jubilee Hills, Hyderabad', 1),
    ('streetlight', 'active', ST_GeographyFromText('POINT(78.5000 17.4000)'), 'Secunderabad, Hyderabad',  2)
ON CONFLICT DO NOTHING;
