-- Update search function to use embedding_small for coarse search
CREATE OR REPLACE FUNCTION search_similar_chunks_coarse(
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
  chunk_index int,
  embedding_large vector(1024)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id AS chunk_id,
    dc.document_id,
    dc.chunk_text,
    1 - (dc.embedding_small <=> query_embedding) AS similarity,
    d.title,
    d.source_url,
    d.document_type,
    dc.chunk_index,
    dc.embedding_large
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
    AND 1 - (dc.embedding_small <=> query_embedding) > match_threshold
    -- Only return chunks with both embeddings
    AND dc.embedding_small IS NOT NULL
    AND dc.embedding_large IS NOT NULL
  ORDER BY dc.embedding_small <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create function for server rerank (using embedding_large)
CREATE OR REPLACE FUNCTION calculate_similarity_large(
  query_embedding vector(1024),
  chunk_embedding vector(1024)
)
RETURNS float
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 1 - (query_embedding <=> chunk_embedding);
END;
$$;

-- Add comments
COMMENT ON FUNCTION search_similar_chunks_coarse IS 
'Performs coarse semantic search using 384-dim embeddings from browser (e5-small).
Returns top candidates with their 1024-dim embeddings for server rerank.';

COMMENT ON FUNCTION calculate_similarity_large IS 
'Calculates cosine similarity using 1024-dim embeddings (e5-large) for precise reranking.';
