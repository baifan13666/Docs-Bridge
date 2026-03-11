# Vercel Deployment Guide - Transformers.js with WASM

## Critical Changes for Serverless Deployment

This guide explains the changes needed to deploy `@huggingface/transformers` on Vercel without native dependencies.

---

## Problem

`@huggingface/transformers` includes `onnxruntime-node` as a dependency, which requires native `.so` shared libraries:
```
Error: libonnxruntime.so.1: cannot open shared object file: No such file or directory
```

Vercel's serverless environment doesn't have these native libraries, causing deployment failures.

---

## Solution: Force WASM Backend

### 1. npm Overrides (package.json)

Add this to `package.json` to replace `onnxruntime-node` with `onnxruntime-web`:

```json
{
  "overrides": {
    "onnxruntime-node": "npm:onnxruntime-web@^1.24.3"
  }
}
```

This forces ALL packages (including `@huggingface/transformers`) to use the WASM version instead of the native version.

### 2. npm Configuration (.npmrc)

Create `.npmrc` to ensure overrides are respected:

```
# Force npm to respect overrides
legacy-peer-deps=false
strict-peer-dependencies=false

# Ensure overrides are applied during install
prefer-dedupe=true
```

### 3. Next.js Configuration (next.config.ts)

Configure webpack to exclude native packages:

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

### 4. Vercel Configuration (vercel.json)

Allocate sufficient memory and timeout:

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

---

## Deployment Steps

### Step 1: Verify Local Build

```bash
npm install
npm run build
```

Expected output:
```
✓ Compiled successfully
```

### Step 2: Verify Override is Applied

```bash
npm ls onnxruntime-node
```

Expected output:
```
└─┬ @huggingface/transformers@3.8.1
  └── onnxruntime-node@npm:onnxruntime-web@1.24.3 overridden
```

If you see `onnxruntime-node@1.21.0` (without "overridden"), the override didn't work. Delete `node_modules` and `package-lock.json`, then run `npm install` again.

### Step 3: Commit Changes

```bash
git add .npmrc package.json package-lock.json
git commit -m "Fix: Force WASM backend for Transformers.js on Vercel

- Add npm overrides to replace onnxruntime-node with onnxruntime-web
- Add .npmrc to ensure overrides are respected
- Prevents 'libonnxruntime.so.1: cannot open shared object file' error
- Enables serverless deployment without native dependencies"
git push
```

### Step 4: Deploy to Vercel

Vercel will automatically deploy when you push to your main branch.

### Step 5: Monitor Deployment Logs

In Vercel dashboard, check the deployment logs for:

✅ **Success indicators**:
```
[Query Embeddings] Initializing bge-small-en-v1.5 (384-dim) with WASM backend...
[Query Embeddings] ✅ bge-small-en-v1.5 model ready (WASM)
```

❌ **Failure indicators**:
```
Error: libonnxruntime.so.1: cannot open shared object file
Cannot find package 'onnxruntime-common'
```

---

## Testing After Deployment

### Test 1: Generate Embedding

```bash
curl -X POST https://your-app.vercel.app/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"text": "test query"}'
```

Expected response:
```json
{
  "embedding": [0.123, -0.456, ...],
  "dimension": 384,
  "cached": false
}
```

### Test 2: Verify Caching

Run the same request again:

```json
{
  "embedding": [0.123, -0.456, ...],
  "dimension": 384,
  "cached": true
}
```

### Test 3: Check Performance

- **First request (cold start)**: 5-15 seconds (model download)
- **Second request (warm)**: 100-500ms (model in memory)
- **Cached request**: 10-50ms (database lookup)

---

## Troubleshooting

### Issue: "libonnxruntime.so.1: cannot open shared object file"

**Cause**: npm overrides not applied during Vercel build

**Solution**:
1. Verify `.npmrc` is committed to git
2. Delete `node_modules` and `package-lock.json` locally
3. Run `npm install` (not `pnpm` or `yarn`)
4. Verify override: `npm ls onnxruntime-node` shows "overridden"
5. Commit and push `package-lock.json`

### Issue: "Cannot find package 'onnxruntime-common'"

**Cause**: Missing dependency

**Solution**:
```bash
npm install onnxruntime-common@^1.24.3 onnxruntime-web@^1.24.3
git add package.json package-lock.json
git commit -m "Add onnxruntime dependencies"
git push
```

### Issue: Build succeeds but runtime fails

**Cause**: Webpack bundling the wrong version

**Solution**: Verify `next.config.ts` has:
```typescript
webpack: (config) => {
  config.resolve.alias = {
    ...config.resolve.alias,
    "sharp$": false,
    "onnxruntime-node$": false,
  };
  return config;
},
serverExternalPackages: ['sharp', 'onnxruntime-node'],
```

### Issue: Memory errors on Vercel

**Cause**: Insufficient memory allocation

**Solution**: Increase memory in `vercel.json`:
```json
{
  "functions": {
    "app/api/**/*.ts": {
      "memory": 1536,
      "maxDuration": 30
    }
  }
}
```

---

## Why This Works

### The Problem Chain

1. `@huggingface/transformers` depends on `onnxruntime-node`
2. `onnxruntime-node` is a native Node.js addon (requires `.so` files)
3. Vercel's serverless environment doesn't have these native libraries
4. Even with webpack aliases, the package is still installed and tries to load

### The Solution Chain

1. npm overrides replace `onnxruntime-node` with `onnxruntime-web` at install time
2. `onnxruntime-web` is pure JavaScript + WebAssembly (no native dependencies)
3. Webpack aliases prevent accidental bundling of native packages
4. `serverExternalPackages` tells Next.js to keep them external
5. WASM backend runs in any environment (serverless, edge, browser)

---

## Performance Comparison

| Backend | Speed | Portability | Memory | Use Case |
|---------|-------|-------------|--------|----------|
| Native (`onnxruntime-node`) | Fast | Low | 300MB | Local development, VPS |
| WASM (`onnxruntime-web`) | Medium | High | 500MB | Serverless, edge, browser |

For serverless deployments, WASM is the only option.

---

## Additional Resources

- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Vercel Functions Configuration](https://vercel.com/docs/functions/serverless-functions/runtimes)
- [npm Overrides Documentation](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#overrides)

---

## Summary

✅ Use npm overrides to force WASM backend  
✅ Add `.npmrc` to ensure overrides work  
✅ Configure webpack to exclude native packages  
✅ Allocate sufficient memory in Vercel  
✅ Test locally before deploying  
✅ Monitor Vercel logs for success indicators  

This configuration enables `@huggingface/transformers` to run on Vercel without any native dependencies.
