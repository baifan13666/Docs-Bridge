-- Update query_history table to support 384-dim embeddings (e5-small)
-- This is the standard dimension for browser-side query embeddings

-- Drop existing table if it exists
DROP TABLE IF EXISTS query_history CASCADE;

-- Recreate with correct dimension
CREATE TABLE query_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_language VARCHAR(10),
  embedding vector(384), -- 384-dim for e5-small (browser)
  retrieved_chunks UUID[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE query_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own query history"
  ON query_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own query history"
  ON query_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_query_history_user_id ON query_history(user_id);
CREATE INDEX idx_query_history_conversation_id ON query_history(conversation_id);
CREATE INDEX idx_query_history_created_at ON query_history(created_at DESC);

-- Create index for vector similarity search (if needed)
CREATE INDEX idx_query_history_embedding ON query_history 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

COMMENT ON TABLE query_history IS 'Stores user query history with 384-dim embeddings from e5-small model';
COMMENT ON COLUMN query_history.embedding IS '384-dimensional embedding vector from multilingual-e5-small (browser)';
