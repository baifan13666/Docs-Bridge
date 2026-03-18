/**
 * Query Embedding Cache Service
 * 
 * Implements intelligent caching for query embeddings with:
 * - Hash-based exact matching
 * - Semantic similarity matching via templates
 * - Cache hit tracking and analytics
 * - Automatic cache warming
 * 
 * NOTE: This module handles cache lookup and storage.
 * Embedding generation can happen either:
 * 1. Client-side (preferred) - in the browser using @huggingface/transformers
 * 2. Server-side (fallback) - when cache misses and client doesn't provide embedding
 */

import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

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

function normalizeEmbedding(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const arr = raw.map((v) => Number(v)).filter((v) => Number.isFinite(v));
    return arr.length > 0 ? arr : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const arr = parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v));
        return arr.length > 0 ? arr : null;
      }
    } catch {
      // fall through to manual parse
    }
    const normalized = trimmed.replace(/^\[/, '').replace(/\]$/, '');
    const parts = normalized.split(',').map((p) => Number(p.trim())).filter((v) => Number.isFinite(v));
    return parts.length > 0 ? parts : null;
  }
  return null;
}

/**
 * Normalize query text for consistent hashing and matching
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    // Don't remove non-ASCII characters - keep Unicode for multilingual support
    .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove punctuation but keep letters and numbers (Unicode-aware)
    .replace(/\b(how|to|what|is|are|can|i|the|a|an)\b/g, '') // Remove common English stopwords
    .trim();
}

/**
 * Generate hash for query caching using Web Crypto API
 * Compatible with both Node.js and Edge Runtime
 */
async function generateQueryHash(query: string): Promise<string> {
  const normalized = normalizeQuery(query);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
 * Get cached embedding (lookup only - does NOT generate)
 * 
 * Flow:
 * 1. Check exact hash match in cache
 * 2. If not found, check semantic similarity with templates
 * 3. Return null if no match found (caller can generate if needed)
 * 
 * NOTE: This function does NOT generate embeddings.
 * If no cache hit, return null and let caller decide whether to generate.
 */
export async function getCachedEmbedding(
  query: string,
  language?: string,
  dialect?: string
): Promise<CachedEmbedding | null> {
  const supabase = await createClient();
  const queryHash = await generateQueryHash(query);
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
      const normalizedEmbedding = normalizeEmbedding(cachedResult.embedding);
      if (!normalizedEmbedding) {
        console.warn('[Embedding Cache] Cache hit but embedding failed to parse, skipping cache result');
        return null;
      }
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
        embedding: normalizedEmbedding,
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

  // Step 3: No cache hit - return null (caller will generate)
  console.log('[Embedding Cache] ❌ No cache hit - caller must generate embedding');
  return null;
}

/**
 * Find best matching template using semantic similarity
 * 
 * NOTE: Template matching is disabled because it requires generating
 * an embedding for the query, which we no longer do server-side.
 * Templates are still useful for pre-cached common queries.
 */
async function findBestTemplate(
  query: string,
  language?: string,
  minSimilarity: number = 0.85 // 85% similarity threshold
): Promise<(QueryTemplate & { similarity: number }) | null> {
  // Template matching disabled - would require server-side embedding generation
  // Templates are still useful as pre-cached queries (exact hash match)
  console.log('[Embedding Cache] Template similarity matching disabled (requires client-side generation)');
  return null;
}

/**
 * Cache an embedding in the database
 */
export async function cacheEmbedding(
  query: string,
  embedding: number[],
  language?: string,
  dialect?: string,
  queryHash?: string
): Promise<void> {
  const supabase = await createClient();
  const hash = queryHash || await generateQueryHash(query);
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
 * 
 * NOTE: This function is deprecated because it requires server-side
 * embedding generation. Use client-side cache warming instead.
 * 
 * To warm up cache:
 * 1. User visits app (client-side model loads)
 * 2. Background task generates embeddings for common queries
 * 3. Embeddings are cached via API for future use
 */
export async function warmupQueryTemplates(supabase?: SupabaseClient): Promise<void> {
  console.log('[Embedding Cache] ⚠️ Server-side template warmup is deprecated');
  console.log('[Embedding Cache] Please use client-side cache warming instead');
  console.log('[Embedding Cache] See CLIENT_EMBEDDING_GUIDE.md for details');
  
  // Return immediately - no server-side generation
  return;
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
