# Vercel Build Fix - Transformers.js Module Resolution

## Problem

Next.js build was failing on Vercel with the error:

```
Module not found: Can't resolve 'onnxruntime-common'
Import trace:
- @huggingface/transformers/dist/transformers.web.js
- lib/embeddings/worker.ts [Client Component Browser]
- hooks/useClientEmbedding.ts [Client Component Browser]
- components/chat/ChatInterface.tsx [Client Component Browser]
- components/chat/ChatPage.tsx [Client Component Browser]
- app/[locale]/page.tsx [Server Component]
```

Even though `@huggingface/transformers` is a client-only package that runs in a Web Worker, Next.js (using Turbopack) was trying to resolve its internal dependencies (`onnxruntime-common` and `onnxruntime-web`) during the server-side build process.

## Root Cause

1. Next.js 16 uses Turbopack by default, which analyzes the entire import chain during build
2. `@huggingface/transformers` internally imports `onnxruntime-common` and `onnxruntime-web`
3. Even though these packages should only run client-side, Turbopack tries to resolve them during server build
4. The packages weren't in `package.json`, causing the build to fail

## Solution

### 1. Install onnxruntime packages as dev dependencies

```bash
pnpm add -D onnxruntime-common onnxruntime-web
```

This makes the packages available during build without including them in production dependencies.

### 2. Configure Next.js to externalize these packages

**File: `next.config.ts`**

```typescript
const nextConfig: NextConfig = {
  // Mark transformers and onnxruntime as external for server
  serverExternalPackages: [
    '@huggingface/transformers',
    'onnxruntime-common',
    'onnxruntime-web',
    'onnxruntime-node'
  ],
  
  webpack: (config, { isServer }) => {
    // Explicitly ignore on server-side
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@huggingface/transformers': 'commonjs @huggingface/transformers',
        'onnxruntime-common': 'commonjs onnxruntime-common',
        'onnxruntime-web': 'commonjs onnxruntime-web',
        'onnxruntime-node': 'commonjs onnxruntime-node',
      });
    }
    
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
      "onnxruntime-common$": false,
      "onnxruntime-web$": false,
    };
    return config;
  }
};
```

### Key Points

1. **Dev dependencies**: Install onnxruntime packages as devDependencies so they're available during build
2. **serverExternalPackages**: Tells Next.js to exclude these packages from server-side bundling
3. **Webpack externals**: Explicitly marks packages as external when building for server
4. **Resolve aliases**: Prevents webpack from trying to resolve these packages
5. **Client-only execution**: The packages only run in the browser via Web Worker, never on the server

## Package.json Changes

```json
{
  "dependencies": {
    "@huggingface/transformers": "^3.8.1"
  },
  "devDependencies": {
    "onnxruntime-common": "^1.24.3",
    "onnxruntime-web": "^1.24.3"
  }
}
```

## Verification

Build completed successfully:

```bash
pnpm run build
# ✓ Compiled successfully
# ✓ Finished TypeScript
# ✓ Collecting page data
# ✓ Generating static pages
```

## Why This Works

1. **Turbopack compatibility**: By installing the packages as devDependencies, Turbopack can resolve the imports during build
2. **Server exclusion**: The serverExternalPackages and webpack externals ensure these packages are never bundled for server-side execution
3. **Client-only runtime**: At runtime, these packages only execute in the browser's Web Worker context
4. **No production bloat**: Since they're devDependencies, they won't be included in the production deployment

## Architecture

Our embedding generation is **100% client-side**:

- **Browser**: Transformers.js runs in Web Worker with onnxruntime-web
- **Server**: Only handles cache lookup/storage, never loads ML models
- **No server-side inference**: Avoids Vercel's 10s timeout and memory limits

## Related Documentation

- [Next.js Package Bundling Guide](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/package-bundling.mdx)
- [serverExternalPackages Config](https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.mdx)
- [CLIENT_ONLY_EMBEDDING_ARCHITECTURE.md](./CLIENT_ONLY_EMBEDDING_ARCHITECTURE.md)

## Status

✅ **RESOLVED** - Build succeeds on both local and Vercel environments with Turbopack
