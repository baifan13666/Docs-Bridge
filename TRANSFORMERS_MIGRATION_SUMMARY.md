# Transformers.js Migration Summary

## Migration Complete: @xenova/transformers → @huggingface/transformers

**Date**: March 11, 2026  
**Status**: ✅ Build Successful  
**Next Step**: Deploy to Vercel and test in production

---

## What Changed

### 1. Package Migration

**Removed** (deprecated):
```json
"@xenova/transformers": "^2.17.2"
```

**Added** (official, maintained):
```json
"@huggingface/transformers": "^3.8.1",
"onnxruntime-web": "^1.24.3",
"onnxruntime-common": "^1.24.3"
```

### 2. Code Updates

**File**: `lib/embeddings/query.ts`

**Key Changes**:
- Import from `@huggingface/transformers` instead of `@xenova/transformers`
- Changed `quantized: true` → `dtype: 'q8'` (v3 API)
- Added null-safety checks for `env.backends?.onnx?.wasm`
- Configured WASM backend with `proxy: false` to avoid native library dependencies
- Model name remains: `Xenova/bge-small-en-v1.5` (this is the Hugging Face model ID)

**Before** (v2 API):
```typescript
import { pipeline, env } from '@xenova/transformers';

pipeline_instance = await pipeline('feature-extraction', MODEL, {
  quantized: true,
});
```

**After** (v3 API):
```typescript
import { pipeline, env } from '@huggingface/transformers';

// Force WASM backend
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.simd = true;
}

pipeline_instance = await pipeline('feature-extraction', MODEL, {
  dtype: 'q8', // Quantized 8-bit
});
```

### 3. Next.js Configuration

**File**: `next.config.ts`

**Configuration** (aligned with official Transformers.js docs for Next.js 16):
```typescript
const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "sharp$": false,
      "onnxruntime-node$": false,
    };
    return config;
  },
  serverExternalPackages: ['sharp', 'onnxruntime-node'],
};
```

**Why these settings**:
- `sharp$: false` - Prevents webpack from bundling the native Sharp image library
- `onnxruntime-node$: false` - Prevents webpack from bundling native ONNX runtime
- `serverExternalPackages` - Tells Next.js to keep these packages external (not bundled)
- This forces the use of WASM-based `onnxruntime-web` instead of native `onnxruntime-node`

### 4. Vercel Configuration

**File**: `vercel.json`

```json
{
  "functions": {
    "app/api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 30
    }
  }
}
```

**Why these settings**:
- `memory: 1024` - Provides sufficient memory for model loading (1GB)
- `maxDuration: 30` - Allows up to 30 seconds for first-time model download

---

## Architecture

### Embedding Generation Flow

```
User Request
    ↓
/api/embeddings
    ↓
lib/embeddings/cache.ts (check cache)
    ↓
Cache Hit? → Return cached embedding
    ↓ No
lib/embeddings/query.ts
    ↓
@huggingface/transformers (v3)
    ↓
onnxruntime-web (WASM backend)
    ↓
bge-small-en-v1.5 model (384-dim)
    ↓
Save to cache → Return embedding
```

### Key Components

1. **Model**: `Xenova/bge-small-en-v1.5` (384 dimensions)
2. **Backend**: WASM (via `onnxruntime-web`)
3. **Runtime**: Node.js (standard, not Edge)
4. **Quantization**: 8-bit (`dtype: 'q8'`)

---

## Why WASM Backend?

### Problem with Native Backend
The previous error was:
```
Cannot find module '../build/Release/sharp-linux-x64.node'
libonnxruntime.so.1.14.0: cannot open shared object file
```

This happened because:
1. Vercel's serverless environment doesn't have native ONNX runtime libraries
2. The old `@xenova/transformers` tried to use `onnxruntime-node` (native)
3. Native `.node` binaries and `.so` shared libraries aren't available

### Solution: WASM Backend
By using `@huggingface/transformers` v3 with WASM:
1. No native dependencies required
2. Runs entirely in JavaScript/WebAssembly
3. Works in any serverless environment
4. Slightly slower than native, but more portable

---

## Verification Checklist

### ✅ Local Build
- [x] `npm run build` succeeds
- [x] No TypeScript errors
- [x] No webpack warnings about transformers
- [x] Build output shows all API routes compiled

### 🔄 Vercel Deployment (Next Steps)

Deploy and verify:

1. **Check deployment logs** for:
   ```
   [Query Embeddings] Initializing bge-small-en-v1.5 (384-dim) with WASM backend...
   [Query Embeddings] ✅ bge-small-en-v1.5 model ready (WASM)
   ```

2. **Test embedding generation**:
   ```bash
   curl -X POST https://your-app.vercel.app/api/embeddings \
     -H "Content-Type: application/json" \
     -d '{"text": "test query"}'
   ```

3. **Expected response**:
   ```json
   {
     "embedding": [0.123, -0.456, ...], // 384 numbers
     "dimension": 384,
     "cached": false
   }
   ```

4. **Check for errors**:
   - ❌ "Cannot find package 'onnxruntime-common'" → Dependencies not installed
   - ❌ "libonnxruntime.so" → Still trying to use native backend
   - ✅ No errors → WASM backend working correctly

---

## Performance Expectations

### First Request (Cold Start)
- **Time**: 5-15 seconds
- **Why**: Model download from Hugging Face (cached after first use)
- **Memory**: ~500-800 MB

### Subsequent Requests (Warm)
- **Time**: 100-500ms per embedding
- **Why**: Model already loaded in memory
- **Memory**: ~300-500 MB

### Cache Hit
- **Time**: 10-50ms
- **Why**: Direct database lookup, no model inference

---

## Troubleshooting

### If Vercel deployment fails with "Cannot find package 'onnxruntime-common'"

**Cause**: Dependencies not properly installed in deployment

**Solution**:
```bash
# Ensure dependencies are in package.json (not devDependencies)
npm install @huggingface/transformers onnxruntime-web onnxruntime-common

# Commit and redeploy
git add package.json package-lock.json
git commit -m "Add onnxruntime dependencies"
git push
```

### If you see "libonnxruntime.so" errors

**Cause**: Still trying to use native backend

**Solution**: Verify `lib/embeddings/query.ts` has:
```typescript
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.proxy = false;
}
```

### If embeddings are wrong dimension

**Cause**: Wrong model or configuration

**Solution**: Verify model name is `Xenova/bge-small-en-v1.5` (384-dim)

---

## References

### Official Documentation
- [Transformers.js GitHub](https://github.com/huggingface/transformers.js)
- [Transformers.js Next.js Guide](https://huggingface.co/docs/transformers.js/tutorials/next)
- [Available Tasks](https://huggingface.co/docs/transformers.js/pipelines#available-tasks)

### Related Issues
- [Issue #1291: Migration from v2 to v3](https://github.com/huggingface/transformers.js/issues/1291)

### Model Information
- [bge-small-en-v1.5 on Hugging Face](https://huggingface.co/BAAI/bge-small-en-v1.5)
- Dimensions: 384
- Use case: Semantic search, RAG, similarity

---

## Summary

✅ **Migration complete** from deprecated `@xenova/transformers` to official `@huggingface/transformers`  
✅ **Build successful** locally with no errors  
✅ **Configuration aligned** with official Transformers.js documentation  
✅ **WASM backend** configured to avoid native dependency issues  
✅ **Ready for deployment** to Vercel

**Next action**: Deploy to Vercel and monitor logs for successful model initialization.
