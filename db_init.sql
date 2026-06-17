-- ============================================================
-- Civic Issue Reporting System – Database Init Script
-- Run: psql -U postgres -d civic_db -f db_init.sql
-- (create the database first: CREATE DATABASE civic_db;)
-- ============================================================

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
    latitude    DOUBLE PRECISION,
    longitude   DOUBLE PRECISION,
    address     TEXT,
    report_count INTEGER NOT NULL DEFAULT 1,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issues_lat_lng ON issues (latitude, longitude);

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
-- Seed Data (optional – sample issues at real localities)
-- ============================================================
INSERT INTO users (name, email, hashed_password) VALUES
    ('Demo User', 'demo@civic.app', '$2b$12$demohashedpassword00000000000000000000000000000000000')
ON CONFLICT (email) DO NOTHING;

INSERT INTO issues (type, status, latitude, longitude, address, report_count) VALUES
    -- Hyderabad, Telangana
    ('pothole',     'active', 17.4156, 78.4376, 'Road No. 12, Banjara Hills, Hyderabad, Telangana 500034', 3),
    ('garbage',     'active', 17.4313, 78.4070, 'Jubilee Hills Checkpost, Jubilee Hills, Hyderabad, Telangana 500033', 1),
    ('streetlight', 'active', 17.4483, 78.3818, 'Hitech City Road, Madhapur, Hyderabad, Telangana 500081', 2),
    ('pothole',     'active', 17.4401, 78.3489, 'Gachibowli, Hyderabad, Telangana 500032', 1),

    -- Bengaluru, Karnataka
    ('pothole',     'active', 12.9756, 77.6094, 'MG Road, Bengaluru, Karnataka 560001', 4),
    ('garbage',     'active', 12.9352, 77.6245, '80 Feet Road, Koramangala, Bengaluru, Karnataka 560034', 2),
    ('streetlight', 'active', 12.9719, 77.6408, '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038', 1),
    ('pothole',     'active', 12.9698, 77.7500, 'Whitefield Main Road, Whitefield, Bengaluru, Karnataka 560066', 2),

    -- Vijayawada, Andhra Pradesh
    ('pothole',     'active', 16.4986, 80.6480, 'Benz Circle, M.G. Road, Vijayawada, Andhra Pradesh 520010', 3),
    ('garbage',     'active', 16.5108, 80.6236, 'Governorpet, Vijayawada, Andhra Pradesh 520002', 1),
    ('streetlight', 'active', 16.4893, 80.6701, 'Patamata, Vijayawada, Andhra Pradesh 520010', 2),
    ('pothole',     'active', 16.4715, 80.6790, 'Auto Nagar, Vijayawada, Andhra Pradesh 520007', 1)
ON CONFLICT DO NOTHING;
