-- Create crawler_sources table
CREATE TABLE IF NOT EXISTS crawler_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  sitemap_url TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create crawler_pages table
CREATE TABLE IF NOT EXISTS crawler_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES crawler_sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  url_hash TEXT NOT NULL,
  content_hash TEXT,
  title TEXT,
  language TEXT DEFAULT 'en',
  last_crawled_at TIMESTAMPTZ,
  crawl_status TEXT DEFAULT 'pending', -- pending, success, failed, skipped
  error_message TEXT,
  etag TEXT,
  last_modified_header TEXT,
  sitemap_lastmod TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create document_structured_data table
CREATE TABLE IF NOT EXISTS document_structured_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES kb_documents(id) ON DELETE CASCADE UNIQUE,
  page_id UUID REFERENCES crawler_pages(id) ON DELETE CASCADE,
  program_name TEXT,
  eligibility TEXT[] DEFAULT '{}',
  required_documents TEXT[] DEFAULT '{}',
  application_process JSONB DEFAULT '[]',
  benefits TEXT[] DEFAULT '{}',
  contact_info JSONB DEFAULT '{}',
  deadlines JSONB DEFAULT '[]',
  fees JSONB DEFAULT '{}',
  extraction_method TEXT DEFAULT 'rules', -- rules, llm
  confidence NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to document_chunks if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='document_chunks' AND column_name='page_id') THEN
    ALTER TABLE document_chunks ADD COLUMN page_id UUID REFERENCES crawler_pages(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='document_chunks' AND column_name='section_heading') THEN
    ALTER TABLE document_chunks ADD COLUMN section_heading TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='document_chunks' AND column_name='section_level') THEN
    ALTER TABLE document_chunks ADD COLUMN section_level INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='document_chunks' AND column_name='is_section_chunk') THEN
    ALTER TABLE document_chunks ADD COLUMN is_section_chunk BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='document_chunks' AND column_name='last_rerank_score') THEN
    ALTER TABLE document_chunks ADD COLUMN last_rerank_score NUMERIC;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_crawler_pages_source_id ON crawler_pages(source_id);
CREATE INDEX IF NOT EXISTS idx_crawler_pages_url_hash ON crawler_pages(url_hash);
CREATE INDEX IF NOT EXISTS idx_crawler_pages_crawl_status ON crawler_pages(crawl_status);
CREATE INDEX IF NOT EXISTS idx_crawler_pages_last_crawled ON crawler_pages(last_crawled_at);
CREATE INDEX IF NOT EXISTS idx_document_chunks_page_id ON document_chunks(page_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_section ON document_chunks(section_heading) WHERE is_section_chunk = true;
CREATE INDEX IF NOT EXISTS idx_document_structured_data_document_id ON document_structured_data(document_id);

-- Create crawler_metrics table for monitoring
CREATE TABLE IF NOT EXISTS crawler_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  status TEXT NOT NULL, -- success, failed, skipped
  duration_ms INTEGER,
  chunks_created INTEGER DEFAULT 0,
  extraction_method TEXT,
  extraction_confidence NUMERIC,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawler_metrics_timestamp ON crawler_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_crawler_metrics_status ON crawler_metrics(status);

-- Add RLS policies
ALTER TABLE crawler_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_structured_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawler_metrics ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all data
CREATE POLICY "Service role can access crawler_sources" ON crawler_sources
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access crawler_pages" ON crawler_pages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access document_structured_data" ON document_structured_data
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access crawler_metrics" ON crawler_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read crawler_sources" ON crawler_sources
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read crawler_pages" ON crawler_pages
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read document_structured_data" ON document_structured_data
  FOR SELECT USING (auth.role() = 'authenticated');
