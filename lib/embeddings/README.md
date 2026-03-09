# Embeddings Directory

This directory contains embedding generation services for the application.

## Overview

The application uses **bge-small-en-v1.5** (384-dim) for query embeddings to enable semantic search over the knowledge base.

## Files

### `query.ts` ✅ ACTIVE
**Purpose:** Generate query embeddings for RAG search

**Model:** Xenova/bge-small-en-v1.5 (384-dim)

**Usage:**
```typescript
import { generateQueryEmbedding } from '@/lib/embeddings/query';

const embedding = await generateQueryEmbedding("What is the policy?");
// Returns: number[] (384-dim)
```

**Features:**
- Uses WASM backend for Node.js
- Quantized model for efficiency
- Singleton pattern (model loaded once)
- Batch embedding support

**Performance:**
- First call: ~2-3 seconds (model download)
- Subsequent calls: ~100ms
- Memory: ~300MB

---

### `server.ts` ⚠️ LEGACY
**Status:** Legacy file, kept for reference

**Original Purpose:** Generate embeddings using e5-small-v2

**Note:** This file is no longer used by the main application. The new `query.ts` file uses bge-small-en-v1.5 instead. This file is kept for backward compatibility or reference purposes only.

---

### `browser.ts` 📱 CLIENT-SIDE
**Purpose:** Generate embeddings in the browser (if needed)

**Note:** Currently, all embedding generation happens server-side via the `/api/embeddings` endpoint. This file exists for potential future client-side embedding generation.

---

### `server-dual.ts` ⚠️ DEPRECATED
**Status:** Deprecated, no longer used

**Original Purpose:** Two-stage embedding (e5-small + e5-large)

**Note:** The application now uses single-stage search with bge-small only. This file is kept for reference but should not be used in new code.

---

## Architecture

### Current Architecture (Recommended)

```
User Query
    ↓
query.ts (bge-small-en-v1.5, 384-dim)
    ↓
/api/embeddings
    ↓
Database search_chunks_small()
    ↓
Results
```

### Legacy Architecture (Deprecated)

```
User Query
    ↓
server.ts (e5-small, 384-dim) → Coarse search
    ↓
server-dual.ts (e5-large, 1024-dim) → Rerank
    ↓
Results
```

## Migration Guide

### From Old to New

**Before:**
```typescript
import { generateQueryEmbedding } from '@/lib/embeddings/server';
import { generateLargeEmbedding } from '@/lib/embeddings/server-dual';

// Two-stage search
const small = await generateQueryEmbedding(query);
const coarse = await searchCoarse(small);
const large = await generateLargeEmbedding(query);
const results = rerank(coarse, large);
```

**After:**
```typescript
import { generateQueryEmbedding } from '@/lib/embeddings/query';

// Single-stage search
const embedding = await generateQueryEmbedding(query);
const results = await searchChunksSmall(embedding);
```

## API Endpoint

### POST /api/embeddings

Generate embeddings via HTTP API.

**Request:**
```json
{
  "text": "What is the policy on remote work?"
}
```

**Response:**
```json
{
  "embedding": [0.1, 0.2, ...],  // 384 numbers
  "dimension": 384,
  "modelName": "Xenova/bge-small-en-v1.5"
}
```

**Batch Request:**
```json
{
  "texts": ["Query 1", "Query 2", "Query 3"]
}
```

**Batch Response:**
```json
{
  "embeddings": [[...], [...], [...]],  // Array of 384-dim embeddings
  "dimension": 384,
  "modelName": "Xenova/bge-small-en-v1.5"
}
```

## Configuration

### Model Settings

```typescript
// lib/embeddings/query.ts
const MODEL = 'Xenova/bge-small-en-v1.5';
const EMBEDDING_DIM = 384;

// WASM backend
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.simd = true;
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = false;
env.cacheDir = '/tmp/.transformers-cache';
```

### Environment Variables

No environment variables required. The model is downloaded from HuggingFace Hub automatically.

## Database Integration

### Search Function

```sql
-- Search using 384-dim embeddings
SELECT * FROM search_chunks_small(
  query_embedding := embedding,
  match_threshold := 0.7,
  match_count := 10,
  user_id_param := user_id,
  active_folder_ids := folder_ids
);
```

### Schema

```sql
-- document_chunks table
embedding_small vector(384)   -- bge-small (used for search)
embedding_large vector(1024)  -- BGE-M3 (reserved for future)
```

## Performance

### Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| Model initialization | 2-3s | First call only |
| Embedding generation | ~100ms | After warmup |
| Batch (10 queries) | ~500ms | Parallel processing |
| Memory usage | ~300MB | Shared across requests |

### Optimization Tips

1. **Warm up the model** on server start
2. **Use batch processing** for multiple queries
3. **Cache embeddings** for common queries
4. **Monitor memory** usage in production

## Testing

### Unit Tests

```typescript
import { generateQueryEmbedding } from '@/lib/embeddings/query';

describe('Query Embeddings', () => {
  it('generates 384-dim embedding', async () => {
    const embedding = await generateQueryEmbedding('test');
    expect(embedding).toHaveLength(384);
  });

  it('normalizes embeddings', async () => {
    const embedding = await generateQueryEmbedding('test');
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    expect(magnitude).toBeCloseTo(1.0, 5);
  });
});
```

### Integration Tests

```typescript
import { createClient } from '@/lib/supabase/server';
import { generateQueryEmbedding } from '@/lib/embeddings/query';

describe('Search Integration', () => {
  it('searches documents', async () => {
    const supabase = await createClient();
    const embedding = await generateQueryEmbedding('policy');
    
    const { data } = await supabase.rpc('search_chunks_small', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count: 10
    });
    
    expect(data).toBeInstanceOf(Array);
  });
});
```

## Troubleshooting

### Model Loading Issues

**Problem:** Model fails to load

**Solution:**
```typescript
// Check configuration
import { getModelInfo } from '@/lib/embeddings/query';
console.log(getModelInfo());

// Verify network access to HuggingFace
// Check firewall/proxy settings
```

### Dimension Mismatch

**Problem:** Embedding has wrong dimension

**Solution:**
```typescript
const embedding = await generateQueryEmbedding(query);
if (embedding.length !== 384) {
  throw new Error(`Expected 384-dim, got ${embedding.length}-dim`);
}
```

### Slow Performance

**Problem:** Embedding generation is slow

**Possible Causes:**
1. First call (model download)
2. CPU constraints
3. Memory pressure

**Solution:**
- Wait for model to warm up
- Check server resources
- Monitor memory usage

### Memory Issues

**Problem:** High memory usage

**Solution:**
- Model uses ~300MB (normal)
- Check for memory leaks elsewhere
- Consider serverless cold starts

## Best Practices

1. ✅ **Use query.ts for all new code**
2. ✅ **Generate embeddings server-side**
3. ✅ **Use batch processing when possible**
4. ✅ **Cache embeddings for common queries**
5. ✅ **Monitor performance metrics**
6. ❌ **Don't use server.ts or server-dual.ts**
7. ❌ **Don't mix embedding models**
8. ❌ **Don't generate embeddings client-side**

## Resources

- [BGE Model Card](https://huggingface.co/BAAI/bge-small-en-v1.5)
- [Transformers.js Docs](https://huggingface.co/docs/transformers.js)
- [Integration Guide](../../EMBEDDING_INTEGRATION_COMPLETE.md)
- [Quick Start](../../EMBEDDING_QUICK_START.md)

## Support

For questions or issues:
1. Check this README
2. Review integration documentation
3. Check application logs
4. Contact the team

---

**Last Updated:** 2026-03-09
**Current Model:** bge-small-en-v1.5 (384-dim)
**Status:** Production Ready ✅
