-- E-posta doğrulama kodları: kod düz metin olarak saklanmaz, uid ile
-- tuzlanmış SHA-256 özeti tutulur. Kod 10 dakika geçerlidir, 5 yanlış
-- denemede kilitlenir. verified_emails, kodla doğrulanmış hesapların kalıcı
-- kaydıdır (Firebase emailVerified bayrağından bağımsız kaynak).
CREATE TABLE IF NOT EXISTS email_codes (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS verified_emails (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  verified_at TEXT NOT NULL DEFAULT (datetime('now'))
);
