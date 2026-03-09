-- Upgrade vector indexes from IVFFLAT to HNSW for better performance
-- HNSW (Hierarchical Navigable Small World) is faster and more accurate than IVFFLAT
-- Recommended for production use with pgvector

-- Drop old IVFFLAT indexes
DROP INDEX IF EXISTS public.idx_document_chunks_embedding_small;
DROP INDEX IF EXISTS public.idx_document_chunks_embedding_large;
DROP INDEX IF EXISTS public.idx_query_history_embedding;

-- Create HNSW indexes for document_chunks
-- m = 16: number of connections per layer (higher = better recall, more memory)
-- ef_construction = 64: size of dynamic candidate list (higher = better index quality, slower build)
CREATE INDEX idx_document_chunks_embedding_small_hnsw 
ON public.document_chunks 
USING hnsw (embedding_small vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_document_chunks_embedding_large_hnsw 
ON public.document_chunks 
USING hnsw (embedding_large vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Create HNSW index for query_history
CREATE INDEX idx_query_history_embedding_hnsw 
ON public.query_history 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Add comments
COMMENT ON INDEX public.idx_document_chunks_embedding_small_hnsw IS 
'HNSW index for fast 384-dim vector search (e5-small). 
m=16 connections per layer, ef_construction=64 for quality.';

COMMENT ON INDEX public.idx_document_chunks_embedding_large_hnsw IS 
'HNSW index for fast 1024-dim vector search (e5-large). 
m=16 connections per layer, ef_construction=64 for quality.';

COMMENT ON INDEX public.idx_query_history_embedding_hnsw IS 
'HNSW index for query history similarity search (384-dim).';

-- Performance note:
-- HNSW is significantly faster than IVFFLAT for queries
-- Build time is longer but only happens once
-- For 5k-50k chunks, HNSW is the recommended choice
