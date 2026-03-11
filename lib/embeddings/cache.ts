/**
 * Query Embedding Cache Service
 * 
 * Implements intelligent caching for query embeddings with:
 * - Hash-based exact matching
 * - Semantic similarity matching via templates
 * - Cache hit tracking and analytics
 * - Automatic cache warming
 */

import { createClient } from '@/lib/supabase/server';
import { generateQueryEmbedding } from './query';
import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export interface CachedEmbedding {
  embedding: number[];
  language?: string;
  dialect?: string;
  isFromCache: boolean;
  cacheSource: 'exact' | 'template' | 'generated';
  similarity?: number; // For template matches
}

export interface QueryTemplate {
  id: string;
  template_text: string;
  embedding: number[];
  category: string;
  language: string;
  priority: number;
}

/**
 * Normalize query text for consistent hashing and matching
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // 多个空格变成单个空格
    .replace(/[^\w\s]/g, '') // 移除标点符号
    .replace(/\b(how|to|what|is|are|can|i|the|a|an)\b/g, '') // 移除常见停用词
    .trim();
}

/**
 * Generate hash for query caching
 */
function generateQueryHash(query: string): string {
  const normalized = normalizeQuery(query);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Get cached embedding or generate new one
 * 
 * Flow:
 * 1. Check exact hash match in cache
 * 2. If not found, check semantic similarity with templates
 * 3. If no good template match, generate new embedding
 * 4. Cache the result for future use
 */
export async function getCachedEmbedding(
  query: string,
  language?: string,
  dialect?: string
): Promise<CachedEmbedding> {
  const supabase = await createClient();
  const queryHash = generateQueryHash(query);
  const normalizedQuery = normalizeQuery(query);
  
  console.log(`[Embedding Cache] Processing query: "${query}"`);
  console.log(`[Embedding Cache] Hash: ${queryHash.substring(0, 16)}...`);
  console.log(`[Embedding Cache] Normalized: "${normalizedQuery}"`);

  // Step 1: Check exact cache hit
  try {
    const { data: cachedResult, error: cacheError } = await supabase
      .from('query_embeddings')
      .select('embedding, language, dialect, hit_count')
      .eq('query_hash', queryHash)
      .single();

    if (!cacheError && cachedResult) {
      // Update hit count
      await supabase
        .from('query_embeddings')
        .update({ 
          hit_count: cachedResult.hit_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('query_hash', queryHash);

      console.log(`[Embedding Cache] ✅ Exact cache hit! (${cachedResult.hit_count + 1} total hits)`);
      
      return {
        embedding: cachedResult.embedding,
        language: cachedResult.language,
        dialect: cachedResult.dialect,
        isFromCache: true,
        cacheSource: 'exact'
      };
    }
  } catch (error) {
    console.warn('[Embedding Cache] Cache lookup error:', error);
  }

  // Step 2: Check template similarity matching
  try {
    const templateMatch = await findBestTemplate(query, language);
    if (templateMatch) {
      console.log(`[Embedding Cache] ✅ Template match found: "${templateMatch.template_text}" (similarity: ${(templateMatch.similarity! * 100).toFixed(1)}%)`);
      
      // Cache this query with the template embedding
      await cacheEmbedding(query, templateMatch.embedding, language, dialect, queryHash);
      
      return {
        embedding: templateMatch.embedding,
        language: language,
        dialect: dialect,
        isFromCache: true,
        cacheSource: 'template',
        similarity: templateMatch.similarity
      };
    }
  } catch (error) {
    console.warn('[Embedding Cache] Template matching error:', error);
  }

  // Step 3: Generate new embedding
  console.log('[Embedding Cache] 🔄 Generating new embedding...');
  const startTime = Date.now();
  
  try {
    const embedding = await generateQueryEmbedding(query);
    const generationTime = Date.now() - startTime;
    
    console.log(`[Embedding Cache] ✅ New embedding generated in ${generationTime}ms`);
    
    // Cache the new embedding
    await cacheEmbedding(query, embedding, language, dialect, queryHash);
    
    return {
      embedding,
      language,
      dialect,
      isFromCache: false,
      cacheSource: 'generated'
    };
  } catch (error) {
    console.error('[Embedding Cache] ❌ Failed to generate embedding:', error);
    throw error;
  }
}

/**
 * Find best matching template using semantic similarity
 */
async function findBestTemplate(
  query: string,
  language?: string,
  minSimilarity: number = 0.85 // 85% similarity threshold
): Promise<(QueryTemplate & { similarity: number }) | null> {
  const supabase = await createClient();
  
  try {
    // Get active templates, prioritize by language match
    const { data: templates, error } = await supabase
      .from('query_templates')
      .select('id, template_text, embedding, category, language, priority')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(50); // Limit for performance

    if (error || !templates || templates.length === 0) {
      console.log('[Embedding Cache] No templates available');
      return null;
    }

    // Generate embedding for the query to compare with templates
    const queryEmbedding = await generateQueryEmbedding(query);
    
    let bestMatch: (QueryTemplate & { similarity: number }) | null = null;
    let bestSimilarity = minSimilarity;

    for (const template of templates) {
      const similarity = cosineSimilarity(queryEmbedding, template.embedding);
      
      // Boost similarity for language match
      const languageBoost = (language && template.language === language) ? 0.05 : 0;
      const adjustedSimilarity = similarity + languageBoost;
      
      if (adjustedSimilarity > bestSimilarity) {
        bestSimilarity = adjustedSimilarity;
        bestMatch = {
          ...template,
          similarity: adjustedSimilarity
        };
      }
    }

    if (bestMatch) {
      console.log(`[Embedding Cache] Best template: "${bestMatch.template_text}" (${(bestMatch.similarity * 100).toFixed(1)}%)`);
    }

    return bestMatch;
  } catch (error) {
    console.error('[Embedding Cache] Template matching error:', error);
    return null;
  }
}

/**
 * Cache an embedding in the database
 */
async function cacheEmbedding(
  query: string,
  embedding: number[],
  language?: string,
  dialect?: string,
  queryHash?: string
): Promise<void> {
  const supabase = await createClient();
  const hash = queryHash || generateQueryHash(query);
  const normalized = normalizeQuery(query);

  try {
    const { error } = await supabase
      .from('query_embeddings')
      .upsert({
        query_hash: hash,
        query_text: query,
        normalized_query: normalized,
        embedding: embedding,
        language: language,
        dialect: dialect,
        hit_count: 1
      }, {
        onConflict: 'query_hash'
      });

    if (error) {
      console.error('[Embedding Cache] Failed to cache embedding:', error);
    } else {
      console.log('[Embedding Cache] ✅ Embedding cached successfully');
    }
  } catch (error) {
    console.error('[Embedding Cache] Cache storage error:', error);
  }
}

/**
 * Preload common query templates
 */
export async function warmupQueryTemplates(supabase?: SupabaseClient): Promise<void> {
  const client = supabase || (await createClient());
  
  const commonTemplates = [
    // English templates
    { text: "how to apply for bantuan", category: "application", language: "en" },
    { text: "what is bantuan eligibility", category: "eligibility", language: "en" },
    { text: "bantuan application process", category: "application", language: "en" },
    { text: "how to check bantuan status", category: "status", language: "en" },
    { text: "bantuan requirements documents", category: "requirements", language: "en" },
    
    // Malay templates
    { text: "cara mohon bantuan", category: "application", language: "ms" },
    { text: "syarat kelayakan bantuan", category: "eligibility", language: "ms" },
    { text: "proses permohonan bantuan", category: "application", language: "ms" },
    { text: "semak status bantuan", category: "status", language: "ms" },
    { text: "dokumen diperlukan bantuan", category: "requirements", language: "ms" },
    
    // Mixed/Common patterns
    { text: "bantuan sara hidup", category: "living_aid", language: "ms" },
    { text: "emergency assistance", category: "emergency", language: "en" },
    { text: "financial aid application", category: "financial", language: "en" },
  ];

  console.log('[Embedding Cache] 🔥 Warming up query templates...');
  
  for (const template of commonTemplates) {
    try {
      // Check if template already exists
      const { data: existing } = await client
        .from('query_templates')
        .select('id')
        .eq('template_text', template.text)
        .single();

      if (!existing) {
        // Generate embedding for template
        const embedding = await generateQueryEmbedding(template.text);
        
        // Insert template
        const { error } = await client
          .from('query_templates')
          .insert({
            template_text: template.text,
            embedding: embedding,
            category: template.category,
            language: template.language
          });

        if (error) {
          console.error(`[Embedding Cache] Failed to insert template "${template.text}":`, error);
        } else {
          console.log(`[Embedding Cache] ✅ Template cached: "${template.text}"`);
        }
      }
    } catch (error) {
      console.error(`[Embedding Cache] Error processing template "${template.text}":`, error);
    }
  }
  
  console.log('[Embedding Cache] 🔥 Template warmup completed');
}

/**
 * Get cache statistics
 */
export async function getCacheStats(supabase?: SupabaseClient): Promise<{
  totalCachedQueries: number;
  totalHits: number;
  avgHitsPerQuery: number;
  cacheHitRate: number;
  topQueries: Array<{ query: string; hits: number }>;
}> {
  const client = supabase || (await createClient());
  
  try {
    // Get total cached queries and sum of hits
    const { data: embeddings } = await client
      .from('query_embeddings')
      .select('hit_count');

    const totalCachedQueries = embeddings?.length || 0;
    const totalHits = embeddings?.reduce((sum: number, e: any) => sum + (e.hit_count || 0), 0) || 0;
    const avgHitsPerQuery = totalCachedQueries > 0 ? totalHits / totalCachedQueries : 0;

    // Get top queries
    const { data: topQueries } = await client
      .from('query_embeddings')
      .select('query_text, hit_count')
      .order('hit_count', { ascending: false })
      .limit(10);

    return {
      totalCachedQueries,
      totalHits,
      avgHitsPerQuery,
      cacheHitRate: 0, // Will be calculated as we get more usage data
      topQueries: topQueries?.map((q: any) => ({
        query: q.query_text,
        hits: q.hit_count
      })) || []
    };
  } catch (error) {
    console.error('[Embedding Cache] Failed to get cache stats:', error);
    return {
      totalCachedQueries: 0,
      totalHits: 0,
      avgHitsPerQuery: 0,
      cacheHitRate: 0,
      topQueries: []
    };
  }
}