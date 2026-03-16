-- ============================================================================
-- DocsBridge Complete Database Schema
-- ============================================================================
-- This file contains the complete database schema for DocsBridge
-- Run this in Supabase SQL Editor to set up the entire database
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- SECTION 1: BASE TABLES
-- ============================================================================

-- Knowledge Base: Folders
CREATE TABLE IF NOT EXISTS public.kb_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  folder_type TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge Base: Documents
CREATE TABLE IF NOT EXISTS public.kb_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.kb_folders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  icon TEXT,
  content TEXT,
  content_hash TEXT,
  document_type TEXT DEFAULT 'user_created',
  source_url TEXT,
  published_date TIMESTAMPTZ,
  language TEXT,
  raw_content TEXT,
  trust_level DECIMAL(3,2) DEFAULT 0.70,
  last_crawled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  document_chunks UUID[] DEFAULT '{}',
  embeddings_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge Base: Attachments
CREATE TABLE IF NOT EXISTS public.kb_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat: Conversations
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT false
);

-- Chat: Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Plans
CREATE TABLE IF NOT EXISTS public.user_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'business')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  messages_used INTEGER NOT NULL DEFAULT 0,
  messages_limit INTEGER NOT NULL DEFAULT 100,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cycle_start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cycle_end_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Document Chunks (with dual embeddings)
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL,
  chunk_hash TEXT,
  embedding_small vector(384),
  embedding_large vector(1024),
  token_count INT,
  language TEXT,
  page_id UUID,
  section_heading TEXT,
  section_level INTEGER,
  is_section_chunk BOOLEAN DEFAULT false,
  last_rerank_score NUMERIC,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

-- Query History
CREATE TABLE IF NOT EXISTS public.query_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_language VARCHAR(10),
  embedding vector(384),
  retrieved_chunks UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Query Embeddings Cache
CREATE TABLE IF NOT EXISTS public.query_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash TEXT NOT NULL UNIQUE,
  query_text TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  embedding VECTOR(384) NOT NULL,
  language TEXT,
  dialect TEXT,
  hit_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Query Templates
CREATE TABLE IF NOT EXISTS public.query_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_text TEXT NOT NULL,
  normalized_template TEXT NOT NULL,
  embedding VECTOR(384) NOT NULL,
  category TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  priority INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crawler: Sources
CREATE TABLE IF NOT EXISTS public.crawler_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  sitemap_url TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crawler: Pages
CREATE TABLE IF NOT EXISTS public.crawler_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.crawler_sources(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  url_hash TEXT NOT NULL,
  content_hash TEXT,
  title TEXT,
  language TEXT DEFAULT 'en',
  last_crawled_at TIMESTAMPTZ,
  crawl_status TEXT DEFAULT 'pending',
  error_message TEXT,
  etag TEXT,
  last_modified_header TEXT,
  sitemap_lastmod TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Structured Data
CREATE TABLE IF NOT EXISTS public.document_structured_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.kb_documents(id) ON DELETE CASCADE UNIQUE,
  page_id UUID REFERENCES public.crawler_pages(id) ON DELETE CASCADE,
  program_name TEXT,
  eligibility TEXT[] DEFAULT '{}',
  required_documents TEXT[] DEFAULT '{}',
  application_process JSONB DEFAULT '[]',
  benefits TEXT[] DEFAULT '{}',
  contact_info JSONB DEFAULT '{}',
  deadlines JSONB DEFAULT '[]',
  fees JSONB DEFAULT '{}',
  extraction_method TEXT DEFAULT 'rules',
  confidence NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crawler Metrics
CREATE TABLE IF NOT EXISTS public.crawler_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  chunks_created INTEGER DEFAULT 0,
  extraction_method TEXT,
  extraction_confidence NUMERIC,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 2: INDEXES
-- ============================================================================

-- KB Folders Indexes
CREATE INDEX IF NOT EXISTS idx_kb_folders_user_id ON public.kb_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_kb_folders_is_active ON public.kb_folders(is_active);

-- KB Documents Indexes
CREATE INDEX IF NOT EXISTS idx_kb_documents_folder_id ON public.kb_documents(folder_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_user_id ON public.kb_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_document_type ON public.kb_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_kb_documents_content_hash ON public.kb_documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_kb_documents_last_crawled_at ON public.kb_documents(last_crawled_at);
CREATE INDEX IF NOT EXISTS idx_kb_documents_source_url ON public.kb_documents(source_url) WHERE source_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kb_documents_document_chunks ON public.kb_documents USING GIN (document_chunks);
CREATE INDEX IF NOT EXISTS idx_kb_documents_embeddings_updated_at ON public.kb_documents(embeddings_updated_at);

-- KB Attachments Indexes
CREATE INDEX IF NOT EXISTS idx_kb_attachments_document_id ON public.kb_attachments(document_id);

-- Chat Conversations Indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON public.chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON public.chat_conversations(updated_at DESC);

-- Chat Messages Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

-- User Plans Indexes
CREATE INDEX IF NOT EXISTS idx_user_plans_user_id ON public.user_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_plans_status ON public.user_plans(status);
CREATE INDEX IF NOT EXISTS idx_user_plans_cycle_end ON public.user_plans(cycle_end_date);

-- Document Chunks Indexes
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_page_id ON public.document_chunks(page_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_section ON public.document_chunks(section_heading) WHERE is_section_chunk = true;

-- HNSW Vector Indexes for fast similarity search
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_small_hnsw 
ON public.document_chunks 
USING hnsw (embedding_small vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_large_hnsw 
ON public.document_chunks 
USING hnsw (embedding_large vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Query History Indexes
CREATE INDEX IF NOT EXISTS idx_query_history_user_id ON public.query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_query_history_conversation_id ON public.query_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_query_history_created_at ON public.query_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_history_embedding_hnsw 
ON public.query_history 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Query Embeddings Cache Indexes
CREATE INDEX IF NOT EXISTS idx_query_embeddings_hash ON public.query_embeddings(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_normalized ON public.query_embeddings(normalized_query);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_language ON public.query_embeddings(language);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_hit_count ON public.query_embeddings(hit_count DESC);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_created_at ON public.query_embeddings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_embedding ON public.query_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Query Templates Indexes
CREATE INDEX IF NOT EXISTS idx_query_templates_category ON public.query_templates(category);
CREATE INDEX IF NOT EXISTS idx_query_templates_language ON public.query_templates(language);
CREATE INDEX IF NOT EXISTS idx_query_templates_priority ON public.query_templates(priority DESC);
CREATE INDEX IF NOT EXISTS idx_query_templates_active ON public.query_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_query_templates_normalized ON public.query_templates(normalized_template);
CREATE INDEX IF NOT EXISTS idx_query_templates_embedding ON public.query_templates 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Crawler Indexes
CREATE INDEX IF NOT EXISTS idx_crawler_pages_source_id ON public.crawler_pages(source_id);
CREATE INDEX IF NOT EXISTS idx_crawler_pages_url_hash ON public.crawler_pages(url_hash);
CREATE INDEX IF NOT EXISTS idx_crawler_pages_crawl_status ON public.crawler_pages(crawl_status);
CREATE INDEX IF NOT EXISTS idx_crawler_pages_last_crawled ON public.crawler_pages(last_crawled_at);
CREATE INDEX IF NOT EXISTS idx_document_structured_data_document_id ON public.document_structured_data(document_id);
CREATE INDEX IF NOT EXISTS idx_crawler_metrics_timestamp ON public.crawler_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_crawler_metrics_status ON public.crawler_metrics(status);

-- ============================================================================
-- SECTION 3: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- KB Folders Policies
CREATE POLICY "Users can view their own folders"
  ON public.kb_folders FOR SELECT
  USING (auth.uid() = user_id OR is_system = true);

CREATE POLICY "Users can insert their own folders"
  ON public.kb_folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
  ON public.kb_folders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
  ON public.kb_folders FOR DELETE
  USING (auth.uid() = user_id AND is_system = false);

-- KB Documents Policies
CREATE POLICY "Users can view their own documents and gov documents"
  ON public.kb_documents FOR SELECT
  USING (auth.uid() = user_id OR document_type = 'gov_crawled');

CREATE POLICY "Users can insert their own documents"
  ON public.kb_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON public.kb_documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON public.kb_documents FOR DELETE
  USING (auth.uid() = user_id);

-- KB Attachments Policies
CREATE POLICY "Users can view attachments of their documents"
  ON public.kb_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kb_documents d
      WHERE d.id = kb_attachments.document_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert attachments to their documents"
  ON public.kb_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kb_documents d
      WHERE d.id = kb_attachments.document_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete attachments from their documents"
  ON public.kb_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.kb_documents d
      WHERE d.id = kb_attachments.document_id
      AND d.user_id = auth.uid()
    )
  );

-- Chat Conversations Policies
CREATE POLICY "Users can view their own conversations"
  ON public.chat_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
  ON public.chat_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.chat_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON public.chat_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Chat Messages Policies
CREATE POLICY "Users can view messages in their conversations"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = chat_messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

-- User Plans Policies
CREATE POLICY "Users can view their own plan"
  ON public.user_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plan"
  ON public.user_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plan"
  ON public.user_plans FOR UPDATE
  USING (auth.uid() = user_id);

-- Document Chunks Policies
CREATE POLICY "Users can view chunks of their own documents"
  ON public.document_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kb_documents d
      WHERE d.id = document_chunks.document_id
      AND (d.user_id = auth.uid() OR d.document_type = 'gov_crawled')
    )
  );

CREATE POLICY "Users can insert chunks for their own documents"
  ON public.document_chunks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kb_documents d
      WHERE d.id = document_chunks.document_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update chunks of their own documents"
  ON public.document_chunks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.kb_documents d
      WHERE d.id = document_chunks.document_id
      AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete chunks of their own documents"
  ON public.document_chunks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.kb_documents d
      WHERE d.id = document_chunks.document_id
      AND d.user_id = auth.uid()
    )
  );

-- Query History Policies
CREATE POLICY "Users can view their own query history"
  ON public.query_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own query history"
  ON public.query_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Query Embeddings Cache Policies (public read, authenticated write)
CREATE POLICY "Anyone can read query embeddings cache"
  ON public.query_embeddings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert query embeddings"
  ON public.query_embeddings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update query embeddings"
  ON public.query_embeddings FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Query Templates Policies (public read)
CREATE POLICY "Anyone can read query templates"
  ON public.query_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage query templates"
  ON public.query_templates FOR ALL
  USING (auth.role() = 'service_role');

-- Crawler Policies
CREATE POLICY "Service role can access crawler_sources"
  ON public.crawler_sources FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read crawler_sources"
  ON public.crawler_sources FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can access crawler_pages"
  ON public.crawler_pages FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read crawler_pages"
  ON public.crawler_pages FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can access document_structured_data"
  ON public.document_structured_data FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read document_structured_data"
  ON public.document_structured_data FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can access crawler_metrics"
  ON public.crawler_metrics FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- SECTION 4: FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_kb_folders_updated_at ON public.kb_folders;
CREATE TRIGGER update_kb_folders_updated_at
  BEFORE UPDATE ON public.kb_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_kb_documents_updated_at ON public.kb_documents;
CREATE TRIGGER update_kb_documents_updated_at
  BEFORE UPDATE ON public.kb_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_plans_updated_at ON public.user_plans;
CREATE TRIGGER update_user_plans_updated_at
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_chunks_updated_at ON public.document_chunks;
CREATE TRIGGER update_document_chunks_updated_at
  BEFORE UPDATE ON public.document_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_query_embeddings_updated_at ON public.query_embeddings;
CREATE TRIGGER trigger_update_query_embeddings_updated_at
  BEFORE UPDATE ON public.query_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_query_templates_updated_at ON public.query_templates;
CREATE TRIGGER trigger_update_query_templates_updated_at
  BEFORE UPDATE ON public.query_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function: Auto-create free plan for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_plans (user_id, plan_type, status)
  VALUES (NEW.id, 'free', 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function: Set document trust level based on type
CREATE OR REPLACE FUNCTION public.set_document_trust_level()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.document_type = 'gov_crawled' THEN
    NEW.trust_level = 1.00;
  ELSE
    NEW.trust_level = 0.70;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_document_trust_level_trigger ON public.kb_documents;
CREATE TRIGGER set_document_trust_level_trigger
  BEFORE INSERT OR UPDATE OF document_type ON public.kb_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_document_trust_level();

-- Function: Reset usage cycle
CREATE OR REPLACE FUNCTION public.reset_usage_cycle()
RETURNS void AS $$
BEGIN
  UPDATE public.user_plans
  SET 
    messages_used = 0,
    tokens_used = 0,
    cycle_start_date = NOW(),
    cycle_end_date = NOW() + INTERVAL '30 days'
  WHERE cycle_end_date < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Increment message usage
CREATE OR REPLACE FUNCTION public.increment_message_usage(
  p_user_id UUID,
  p_tokens_used INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM reset_usage_cycle();
  
  UPDATE public.user_plans
  SET 
    messages_used = messages_used + 1,
    tokens_used = tokens_used + p_tokens_used,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING jsonb_build_object(
    'messages_used', messages_used,
    'messages_limit', messages_limit,
    'tokens_used', tokens_used,
    'cycle_end_date', cycle_end_date
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user can send message
CREATE OR REPLACE FUNCTION public.can_send_message(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_messages_used INTEGER;
  v_messages_limit INTEGER;
BEGIN
  PERFORM reset_usage_cycle();
  
  SELECT messages_used, messages_limit
  INTO v_messages_used, v_messages_limit
  FROM public.user_plans
  WHERE user_id = p_user_id;
  
  RETURN v_messages_used < v_messages_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.reset_usage_cycle() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_message_usage(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_message(UUID) TO authenticated;

-- ============================================================================
-- SECTION 5: SEARCH FUNCTIONS
-- ============================================================================

-- Function: Search similar chunks (coarse search with small embeddings)
CREATE OR REPLACE FUNCTION search_similar_chunks_coarse(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20,
  p_user_id uuid DEFAULT NULL,
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
    (d.user_id = p_user_id OR d.document_type = 'gov_crawled')
    AND (
      active_folder_ids IS NULL 
      OR d.folder_id = ANY(active_folder_ids)
    )
    AND 1 - (dc.embedding_small <=> query_embedding) > match_threshold
    AND dc.embedding_small IS NOT NULL
    AND dc.embedding_large IS NOT NULL
  ORDER BY dc.embedding_small <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: Search chunks with small embeddings (bge-small compatible)
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
    dc.embedding_small IS NOT NULL
    AND (
      user_id_param IS NULL 
      OR d.user_id = user_id_param 
      OR d.document_type = 'gov_crawled'
    )
    AND (
      active_folder_ids IS NULL 
      OR d.folder_id = ANY(active_folder_ids)
    )
    AND 1 - (dc.embedding_small <=> query_embedding) > match_threshold
  ORDER BY dc.embedding_small <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: Calculate similarity with large embeddings (for reranking)
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

-- Function: Get document chunk statistics
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

-- ============================================================================
-- SECTION 6: VIEWS
-- ============================================================================

-- View: Cache statistics
CREATE OR REPLACE VIEW query_cache_stats AS
SELECT 
  COUNT(*) as total_cached_queries,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits_per_query,
  COUNT(CASE WHEN hit_count > 1 THEN 1 END) as reused_queries,
  ROUND(
    COUNT(CASE WHEN hit_count > 1 THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0)::NUMERIC * 100, 
    2
  ) as cache_hit_rate_percent
FROM query_embeddings;

-- View: Popular queries
CREATE OR REPLACE VIEW popular_queries AS
SELECT 
  query_text,
  normalized_query,
  language,
  dialect,
  hit_count,
  created_at,
  updated_at
FROM query_embeddings
WHERE hit_count > 1
ORDER BY hit_count DESC, updated_at DESC
LIMIT 100;

-- ============================================================================
-- SECTION 7: COMMENTS
-- ============================================================================

COMMENT ON TABLE public.kb_folders IS 'Knowledge base folders for organizing documents';
COMMENT ON TABLE public.kb_documents IS 'Knowledge base documents with trust levels';
COMMENT ON TABLE public.kb_attachments IS 'File attachments for documents';
COMMENT ON TABLE public.chat_conversations IS 'User chat conversations';
COMMENT ON TABLE public.chat_messages IS 'Messages within conversations';
COMMENT ON TABLE public.user_plans IS 'User subscription plans with usage tracking';

COMMENT ON TABLE public.document_chunks IS 'Document chunks with dual embeddings for hybrid retrieval. embedding_small (384-dim): e5-small for browser coarse search, embedding_large (1024-dim): e5-large for server rerank';
COMMENT ON TABLE public.query_history IS 'Stores user query history with 384-dim embeddings from e5-small model';
COMMENT ON TABLE public.query_embeddings IS 'Cache for query embeddings to avoid regeneration';
COMMENT ON TABLE public.query_templates IS 'Pre-defined query templates for semantic matching';
COMMENT ON TABLE public.crawler_sources IS 'Web crawler source configurations';
COMMENT ON TABLE public.crawler_pages IS 'Crawled web pages with metadata';
COMMENT ON TABLE public.document_structured_data IS 'Structured data extracted from documents';
COMMENT ON TABLE public.crawler_metrics IS 'Crawler performance metrics';

COMMENT ON COLUMN public.kb_documents.trust_level IS 'Trust level for confidence scoring: 1.0 for government docs, 0.7 for user docs';
COMMENT ON COLUMN public.kb_documents.document_chunks IS 'Array of document_chunk IDs associated with this document for embedding tracking';
COMMENT ON COLUMN public.kb_documents.embeddings_updated_at IS 'Timestamp when document embeddings were last updated';
COMMENT ON COLUMN public.query_history.embedding IS '384-dimensional embedding vector from multilingual-e5-small (browser)';

COMMENT ON INDEX public.idx_document_chunks_embedding_small_hnsw IS 'HNSW index for fast 384-dim vector search (e5-small). m=16 connections per layer, ef_construction=64 for quality.';
COMMENT ON INDEX public.idx_document_chunks_embedding_large_hnsw IS 'HNSW index for fast 1024-dim vector search (e5-large). m=16 connections per layer, ef_construction=64 for quality.';
COMMENT ON INDEX public.idx_query_history_embedding_hnsw IS 'HNSW index for query history similarity search (384-dim).';

COMMENT ON FUNCTION search_similar_chunks_coarse IS 'Performs coarse semantic search using 384-dim embeddings from browser (e5-small). Returns top candidates with their 1024-dim embeddings for server rerank.';
COMMENT ON FUNCTION search_chunks_small IS 'Performs semantic search using 384-dim bge-small-en-v1.5 embeddings. Compatible with Crawler Service Phase 1 embeddings. Returns chunks sorted by cosine similarity.';
COMMENT ON FUNCTION calculate_similarity_large IS 'Calculates cosine similarity using 1024-dim embeddings (e5-large) for precise reranking.';
COMMENT ON FUNCTION get_document_chunk_stats IS 'Returns statistics about document chunks including embedding availability. Useful for monitoring Crawler Service progress.';

COMMENT ON VIEW query_cache_stats IS 'Cache performance statistics';
COMMENT ON VIEW popular_queries IS 'Most frequently used queries';

-- ============================================================================
-- SECTION 8: INITIAL DATA
-- ============================================================================

-- Insert free plan for existing users (if any)
INSERT INTO public.user_plans (user_id, plan_type, status)
SELECT id, 'free', 'active'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_plans)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
