-- Create function for semantic search with vector similarity
-- This function searches document chunks using cosine similarity
-- and filters by user access (user's own documents + government documents)

CREATE OR REPLACE FUNCTION search_similar_chunks(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20,
  user_id uuid DEFAULT NULL,
  active_folder_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  document_id uuid,
  chunk_text text,
  similarity float,
  title text,
  source_url text,
  document_type text,
  chunk_index int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id AS chunk_id,
    dc.document_id,
    dc.chunk_text,
    1 - (dc.query_embedding <=> query_embedding) AS similarity,
    d.title,
    d.source_url,
    d.document_type,
    dc.chunk_index
  FROM document_chunks dc
  JOIN kb_documents d ON dc.document_id = d.id
  WHERE
    -- Access control: user's own documents OR government documents
    (d.user_id = user_id OR d.document_type = 'gov_crawled')
    -- Filter by active folders if provided
    AND (
      active_folder_ids IS NULL 
      OR d.folder_id = ANY(active_folder_ids)
    )
    -- Similarity threshold
    AND 1 - (dc.query_embedding <=> query_embedding) > match_threshold
  ORDER BY dc.query_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create index for faster vector search
CREATE INDEX IF NOT EXISTS idx_document_chunks_query_embedding 
ON document_chunks 
USING ivfflat (query_embedding vector_cosine_ops)
WITH (lists = 100);

-- Add comment
COMMENT ON FUNCTION search_similar_chunks IS 
'Performs semantic search on document chunks using cosine similarity. 
Filters by user access and active folders. 
Uses 384-dim embeddings from browser (e5-small).';
