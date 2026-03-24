-- ═══════════════════════════════════════════════════════════════════════════
--  EasySchema — Database Migration
--  Run: psql -U postgres -d dbstudio -f scripts/migrate.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ─── Projects ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects (user_id);

-- ─── Schema Versions ───────────────────────────────────────────────────────
-- Each save creates a new row; "latest" = MAX(version_number) for a project.
CREATE TABLE IF NOT EXISTS schema_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number  INT NOT NULL,
  name            VARCHAR(200),
  description     TEXT,
  -- The full schema snapshot stored as JSONB
  tables          JSONB NOT NULL DEFAULT '[]',
  relationships   JSONB NOT NULL DEFAULT '[]',
  indexes         JSONB NOT NULL DEFAULT '{}',
  health_score    INT,
  prompt_score    INT,
  prompt_text     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (project_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_schema_versions_project ON schema_versions (project_id);

-- ─── Audit Results ──────────────────────────────────────────────────────────
-- Saved per schema-version; stores the full SchemaHealthResult as JSONB.
CREATE TABLE IF NOT EXISTS audit_results (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version_id   UUID NOT NULL REFERENCES schema_versions(id) ON DELETE CASCADE,
  total_score         INT NOT NULL,
  max_score           INT NOT NULL DEFAULT 100,
  breakdown           JSONB NOT NULL,
  all_issues          JSONB NOT NULL DEFAULT '[]',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_results_version ON audit_results (schema_version_id);

-- ─── Updated-at trigger ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── AI Prompt Cache ────────────────────────────────────────────────────────
-- Stores hashed prompt → AI response pairs to avoid redundant Groq API calls.
-- Keyed by sha256(task_type::normalized_prompt).
CREATE TABLE IF NOT EXISTS ai_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash   VARCHAR(64) NOT NULL,  -- sha256 hex digest
  task_type     VARCHAR(20) NOT NULL,  -- 'generate' | 'analyze' | 'refine' | 'review'
  response_json JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (prompt_hash, task_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_hash_type ON ai_cache (prompt_hash, task_type);
CREATE INDEX IF NOT EXISTS idx_ai_cache_created ON ai_cache (created_at);
