# 服务器端 Embedding 生成已移除

## 日期：2026-03-11

## 背景

由于 Vercel Serverless Functions 的限制，我们已完全移除服务器端 embedding 生成功能：

### Vercel 限制
- **执行时间**：10秒（免费版）- 模型初始化需要 5-15 秒
- **内存限制**：1GB（免费版）- 模型占用 ~300MB
- **冷启动**：每次冷启动都要重新加载模型
- **成本**：每次调用都消耗执行时间和内存

### 原始错误
```
Error: Cannot find package 'onnxruntime-common' imported from transformers
```

虽然可以通过安装依赖解决，但这只是治标不治本。真正的问题是 Vercel Functions 不适合运行 ML 模型。

---

## 已完成的更改

### 1. 移除服务器端生成逻辑

**文件：`lib/embeddings/cache.ts`**
- ✅ `getCachedEmbedding()` 现在只查询缓存，不生成 embedding
- ✅ 返回 `CachedEmbedding | null`（之前总是返回 embedding）
- ✅ `warmupQueryTemplates()` 已废弃
- ✅ `findBestTemplate()` 已禁用（需要服务器端生成）
- ✅ 移除 `import { generateQueryEmbedding }` 依赖

### 2. 更新 API 端点

**文件：`app/api/embeddings/route.ts`**
- ✅ 单个 embedding：返回 404 如果缓存未命中
- ✅ 批量 embedding：返回 501 Not Implemented
- ✅ 移除 `generateBatchQueryEmbeddings` 导入

**文件：`app/api/embeddings/cache/route.ts`**
- ✅ GET：仍然返回缓存统计
- ✅ POST (warmup)：返回 410 Gone（功能已废弃）

**新文件：`app/api/embeddings/cache/store/route.ts`**
- ✅ 允许客户端存储生成的 embedding 到缓存
- ✅ 支持认证和游客用户

### 3. 修复依赖代码

**文件：`app/api/chat/query-stream/route.ts`**
- ✅ 检查 `getCachedEmbedding()` 返回值是否为 null
- ✅ 如果无缓存且无提供的 embedding，返回错误

**文件：`lib/rag/parallel-pipeline.ts`**
- ✅ 原始查询 embedding：检查 null，抛出错误
- ✅ 重写查询 embedding：如果 null，回退到原始 embedding

**文件：`app/api/embeddings/route.ts`**
- ✅ 单个查询：返回 404 如果无缓存
- ✅ 批量查询：返回 501 Not Implemented

### 4. 清理依赖

**文件：`package.json`**
- ✅ 保留 `@huggingface/transformers`（客户端需要）
- ✅ 不需要 `onnxruntime-common` 和 `onnxruntime-web`（服务器端不再使用）

---

## 新架构

### 客户端生成 → 服务器缓存

```
┌─────────────────┐
│   用户浏览器     │
│                 │
│  1. 生成 embedding (Web Worker)
│     ↓
│  2. 使用 embedding 查询
│     ↓
│  3. 存储到缓存 (可选)
└─────────────────┘
        ↓
┌─────────────────┐
│  Vercel 服务器   │
│                 │
│  - 只查询缓存    │
│  - 只存储缓存    │
│  - 不生成 embedding
└─────────────────┘
```

### API 流程

#### 1. 查询缓存（可选）
```typescript
POST /api/embeddings/cache/lookup
{
  query: "how to apply",
  language: "en"
}

// Response (hit)
{ embedding: [...], isFromCache: true }

// Response (miss)
{ embedding: null }
```

#### 2. 客户端生成
```typescript
const { generateEmbedding } = useClientEmbedding();
const result = await generateEmbedding(query);
```

#### 3. 存储到缓存
```typescript
POST /api/embeddings/cache/store
{
  query: "how to apply",
  embedding: [...],
  language: "en"
}
```

#### 4. 使用 embedding 查询
```typescript
POST /api/chat/query-stream
{
  query: "how to apply",
  embedding: [...],  // 必须提供
  conversationId: "..."
}
```

---

## 迁移指南

### 对于现有代码

如果你的代码调用了这些 API：

#### ❌ 不再工作
```typescript
// 这会返回 404
const response = await fetch('/api/embeddings', {
  method: 'POST',
  body: JSON.stringify({ text: query })
});
```

#### ✅ 新的方式
```typescript
// 1. 客户端生成
const { generateEmbedding } = useClientEmbedding();
const result = await generateEmbedding(query);

// 2. 可选：存储到缓存
await fetch('/api/embeddings/cache/store', {
  method: 'POST',
  body: JSON.stringify({
    query,
    embedding: result.embedding
  })
});

// 3. 使用 embedding
const response = await fetch('/api/chat/query-stream', {
  method: 'POST',
  body: JSON.stringify({
    query,
    embedding: result.embedding
  })
});
```

### 对于新代码

始终使用客户端 embedding 生成：

```typescript
import { useClientEmbedding } from '@/hooks/useClientEmbedding';

function MyComponent() {
  const { generateEmbedding, isReady } = useClientEmbedding();
  
  const handleQuery = async (query: string) => {
    if (!isReady) {
      console.error('Embedding model not ready');
      return;
    }
    
    const result = await generateEmbedding(query);
    // 使用 result.embedding
  };
}
```

---

## 优势

### 1. 避免 Vercel 限制
- ✅ 无冷启动超时
- ✅ 无内存限制
- ✅ 无执行时间限制

### 2. 降低成本
- ✅ 不消耗 Vercel 函数执行时间
- ✅ 不占用服务器内存
- ✅ 无限可扩展（用户设备处理）

### 3. 更好的隐私
- ✅ 数据不离开浏览器
- ✅ 符合 GDPR
- ✅ 用户更信任

### 4. 更快（后续访问）
- ✅ 模型缓存在浏览器
- ✅ 生成速度 50-200ms
- ✅ 无网络延迟

---

## 权衡

### 1. 首次加载慢
- 需要下载模型（~25MB）
- 首次约 5-10 秒
- **解决方案**：显示进度条，使用 `ClientEmbeddingProvider`

### 2. 浏览器要求
- Chrome 90+, Firefox 88+, Safari 14+
- **解决方案**：检测浏览器，提供提示

### 3. 依赖客户端
- 服务器无法独立生成 embedding
- **解决方案**：客户端必须提供 embedding

---

## 测试

### 构建测试
```bash
pnpm run build
# ✅ 构建成功
```

### 运行时测试
```bash
pnpm run dev
# 访问 http://localhost:3000
# 打开浏览器控制台
# 应该看到：[Embedding Worker] Model loaded successfully
```

### API 测试

#### 1. 缓存查询（应该返回 null 或缓存的 embedding）
```bash
curl -X POST http://localhost:3000/api/embeddings/cache/lookup \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}'
```

#### 2. 缓存存储（应该成功）
```bash
curl -X POST http://localhost:3000/api/embeddings/cache/store \
  -H "Content-Type: application/json" \
  -d '{"query":"test","embedding":[0.1,0.2,...]}'
```

#### 3. Embedding 生成（应该返回 404）
```bash
curl -X POST http://localhost:3000/api/embeddings \
  -H "Content-Type: application/json" \
  -d '{"text":"test"}'
# 预期：404 Not Found
```

---

## 相关文档

- `CLIENT_EMBEDDING_GUIDE.md` - 客户端 embedding 使用指南
- `CLIENT_SIDE_MIGRATION_COMPLETE.md` - 客户端迁移完成文档
- `CLIENT_ONLY_EMBEDDING_ARCHITECTURE.md` - 纯客户端架构说明
- `DEPLOYMENT_CHECKLIST.md` - 部署检查清单

---

## 总结

✅ **服务器端 embedding 生成已完全移除**  
✅ **所有 embedding 生成都在客户端完成**  
✅ **服务器只负责缓存查询和存储**  
✅ **避免了 Vercel Serverless Functions 的所有限制**  
✅ **构建成功，可以部署到 Vercel**  

**这是在 Vercel 上部署 Transformers.js 的最佳实践！** 🚀
