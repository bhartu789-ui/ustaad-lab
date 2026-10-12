CREATE TABLE IF NOT EXISTS certificates (
 id TEXT PRIMARY KEY,
 student_name TEXT NOT NULL,
 course TEXT NOT NULL,
 school TEXT NOT NULL,
 cert_type TEXT NOT NULL,
 issue_date DATE NOT NULL,
 template TEXT NOT NULL DEFAULT 'classic',
 detail TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS certificates_created_idx ON certificates (created_at DESC);
CREATE TABLE IF NOT EXISTS login_failures (
 id BIGSERIAL PRIMARY KEY,
 ip_hash TEXT NOT NULL,
 created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS login_failures_lookup_idx ON login_failures (ip_hash,created_at);
