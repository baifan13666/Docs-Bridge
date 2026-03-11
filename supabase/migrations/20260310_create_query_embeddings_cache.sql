-- Query Embeddings Cache Table
-- Caches frequently used query embeddings to avoid regeneration

CREATE TABLE IF NOT EXISTS query_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash TEXT NOT NULL UNIQUE,
  query_text TEXT NOT NULL,
  normalized_query TEXT NOT NULL, -- 标准化后的查询（小写、去空格等）
  embedding VECTOR(384) NOT NULL, -- bge-small-en-v1.5 embeddings
  language TEXT, -- 检测到的语言
  dialect TEXT, -- 检测到的方言
  hit_count INTEGER DEFAULT 1, -- 缓存命中次数
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_query_embeddings_hash ON query_embeddings(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_normalized ON query_embeddings(normalized_query);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_language ON query_embeddings(language);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_hit_count ON query_embeddings(hit_count DESC);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_created_at ON query_embeddings(created_at DESC);

-- 向量相似度搜索索引
CREATE INDEX IF NOT EXISTS idx_query_embeddings_embedding ON query_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 更新 updated_at 的触发器
CREATE OR REPLACE FUNCTION update_query_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_query_embeddings_updated_at
  BEFORE UPDATE ON query_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_query_embeddings_updated_at();

-- Query Template Library Table
-- 预定义的常见查询模板
CREATE TABLE IF NOT EXISTS query_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_text TEXT NOT NULL,
  normalized_template TEXT NOT NULL,
  embedding VECTOR(384) NOT NULL,
  category TEXT NOT NULL, -- 'bantuan', 'application', 'eligibility', etc.
  language TEXT NOT NULL DEFAULT 'en',
  priority INTEGER DEFAULT 1, -- 优先级，数字越大越重要
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 模板索引
CREATE INDEX IF NOT EXISTS idx_query_templates_category ON query_templates(category);
CREATE INDEX IF NOT EXISTS idx_query_templates_language ON query_templates(language);
CREATE INDEX IF NOT EXISTS idx_query_templates_priority ON query_templates(priority DESC);
CREATE INDEX IF NOT EXISTS idx_query_templates_active ON query_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_query_templates_normalized ON query_templates(normalized_template);

-- 模板向量搜索索引
CREATE INDEX IF NOT EXISTS idx_query_templates_embedding ON query_templates 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- 模板更新触发器
CREATE TRIGGER trigger_update_query_templates_updated_at
  BEFORE UPDATE ON query_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_query_embeddings_updated_at();

-- 缓存统计视图
CREATE OR REPLACE VIEW query_cache_stats AS
SELECT 
  COUNT(*) as total_cached_queries,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits_per_query,
  COUNT(CASE WHEN hit_count > 1 THEN 1 END) as reused_queries,
  ROUND(
    COUNT(CASE WHEN hit_count > 1 THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100, 
    2
  ) as cache_hit_rate_percent
FROM query_embeddings;

-- 热门查询视图
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

COMMENT ON TABLE query_embeddings IS 'Cache for query embeddings to avoid regeneration';
COMMENT ON TABLE query_templates IS 'Pre-defined query templates for semantic matching';
COMMENT ON VIEW query_cache_stats IS 'Cache performance statistics';
COMMENT ON VIEW popular_queries IS 'Most frequently used queries';