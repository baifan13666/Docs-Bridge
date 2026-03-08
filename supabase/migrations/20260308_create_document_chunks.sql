-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document_chunks table with dual embeddings
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL,
  
  -- Dual embeddings for hybrid retrieval
  embedding_small vector(384), -- e5-small for browser coarse search
  embedding_large vector(1024), -- e5-large for server rerank
  
  -- Metadata
  token_count INT,
  language TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique chunk per document
  UNIQUE(document_id, chunk_index)
);

-- Create indexes for faster vector search
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id 
ON public.document_chunks(document_id);

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_small 
ON public.document_chunks 
USING ivfflat (embedding_small vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_large 
ON public.document_chunks 
USING ivfflat (embedding_large vector_cosine_ops)
WITH (lists = 100);

-- Enable Row Level Security
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Create policies (inherit from kb_documents)
CREATE POLICY "Users can view chunks of their own documents"
  ON public.document_chunks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kb_documents d
      WHERE d.id = document_chunks.document_id
      AND (d.user_id = auth.uid() OR d.document_type = 'gov_crawled')
    )
  );

CREATE POLICY "Users can insert chunks for their own documents"
  ON public.document_chunks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kb_documents d
      WHERE d.id = document_chunks.document_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update chunks of their own documents"
  ON public.document_chunks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.kb_documents d
      WHERE d.id = document_chunks.document_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete chunks of their own documents"
  ON public.document_chunks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.kb_documents d
      WHERE d.id = document_chunks.document_id
      AND d.user_id = auth.uid()
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_document_chunks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_document_chunks_updated_at ON public.document_chunks;
CREATE TRIGGER update_document_chunks_updated_at
  BEFORE UPDATE ON public.document_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_document_chunks_updated_at();

-- Add comment
COMMENT ON TABLE public.document_chunks IS 
'Stores document chunks with dual embeddings for hybrid retrieval.
embedding_small (384-dim): e5-small for browser coarse search
embedding_large (1024-dim): e5-large for server rerank';
