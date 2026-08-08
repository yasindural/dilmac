CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  level TEXT NOT NULL,
  area TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  page TEXT NOT NULL,
  user_agent TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_code ON error_logs(code, created_at DESC);
