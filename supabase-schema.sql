-- Mon Français — Supabase Schema
-- Run this entire file in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

-- Single table storing all user state as JSONB.
-- Simple, fast to implement, and easy to extend later.
CREATE TABLE IF NOT EXISTS user_state (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state       JSONB DEFAULT '{}',       -- task completions, SRS data, speak history
  vocab_bank  JSONB DEFAULT '[]',       -- generated vocabulary words
  vocab_gen   JSONB DEFAULT '{}',       -- vocab generation progress
  grammar_srs JSONB DEFAULT '{}',       -- per-question grammar SRS
  grammar_scores JSONB DEFAULT '{}',    -- grammar topic scores
  grammar_streak INTEGER DEFAULT 0,
  grammar_notes  JSONB DEFAULT '[]',
  my_words    JSONB DEFAULT '[]',       -- personal word list
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security: users can only read/write their own row
ALTER TABLE user_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own state"
  ON user_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own state"
  ON user_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own state"
  ON user_state FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own state"
  ON user_state FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update the updated_at timestamp on every write
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_state_updated_at
  BEFORE UPDATE ON user_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
