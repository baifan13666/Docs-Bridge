-- Create search function for bge-small embeddings (384-dim)
-- This function is compatible with the new Crawler Service that uses bge-small-en-v1.5

CREATE OR REPLACE FUNCTION search_chunks_small(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  user_id_param uuid DEFAULT NULL,
  active_folder_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_text text,
  similarity float,
  title text,
  source_url text,
  document_type text,
  chunk_index int,
  token_count int,
  language text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    1 - (dc.embedding_small <=> query_embedding) AS similarity,
    d.title,
    d.source_url,
    d.document_type,
    dc.chunk_index,
    dc.token_count,
    dc.language
  FROM document_chunks dc
  JOIN kb_documents d ON dc.document_id = d.id
  WHERE
    -- Only return chunks with embedding_small
    dc.embedding_small IS NOT NULL
    -- Access control: user's own documents OR government documents
    AND (
      user_id_param IS NULL 
      OR d.user_id = user_id_param 
      OR d.document_type = 'gov_crawled'
    )
    -- Filter by active folders if provided
    AND (
      active_folder_ids IS NULL 
      OR d.folder_id = ANY(active_folder_ids)
    )
    -- Similarity threshold
    AND 1 - (dc.embedding_small <=> query_embedding) > match_threshold
  ORDER BY dc.embedding_small <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add comment
COMMENT ON FUNCTION search_chunks_small IS 
'Performs semantic search using 384-dim bge-small-en-v1.5 embeddings.
Compatible with Crawler Service Phase 1 embeddings.
Returns chunks sorted by cosine similarity.';

-- Create function to get chunk count by document
CREATE OR REPLACE FUNCTION get_document_chunk_stats(document_id_param uuid)
RETURNS TABLE (
  total_chunks int,
  chunks_with_small int,
  chunks_with_large int,
  avg_token_count float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::int AS total_chunks,
    COUNT(embedding_small)::int AS chunks_with_small,
    COUNT(embedding_large)::int AS chunks_with_large,
    AVG(token_count)::float AS avg_token_count
  FROM document_chunks
  WHERE document_id = document_id_param;
END;
$$;

COMMENT ON FUNCTION get_document_chunk_stats IS 
'Returns statistics about document chunks including embedding availability.
Useful for monitoring Crawler Service progress.';
