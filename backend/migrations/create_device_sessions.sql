-- Run this in Supabase Dashboard > SQL Editor
-- Crea la tabella per il controllo sessioni dispositivi (anti password sharing)

CREATE TABLE IF NOT EXISTS device_sessions (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id     TEXT        NOT NULL,
  device_name   TEXT,
  last_seen     TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_user_id ON device_sessions(user_id);
