-- Add crawler-related columns to kb_documents
-- These columns support the web crawler functionality

-- Add content_hash for change detection
ALTER TABLE public.kb_documents 
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add last_crawled_at timestamp
ALTER TABLE public.kb_documents 
ADD COLUMN IF NOT EXISTS last_crawled_at TIMESTAMPTZ;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_kb_documents_content_hash 
ON public.kb_documents(content_hash);

CREATE INDEX IF NOT EXISTS idx_kb_documents_last_crawled_at 
ON public.kb_documents(last_crawled_at);

-- Add comments
COMMENT ON COLUMN public.kb_documents.content_hash IS 'SHA-256 hash of document content for change detection by crawler';
COMMENT ON COLUMN public.kb_documents.last_crawled_at IS 'Timestamp of last successful crawl for this document';
