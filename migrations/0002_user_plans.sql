CREATE TABLE IF NOT EXISTS user_plans (
  uid TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  source TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
