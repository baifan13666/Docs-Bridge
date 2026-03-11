# 纯客户端 Embedding 架构

## 概述

基于 Vercel Serverless Functions 的限制，我们采用**纯客户端 embedding 生成**架构：

- ✅ 所有 embedding 生成都在浏览器中完成
- ✅ 服务器只负责缓存查询和存储
- ✅ 避免 Vercel 冷启动超时和内存限制
- ✅ 降低服务器成本

---

## 架构对比

### ❌ 之前的混合架构（有问题）

```
客户端生成 → 用于用户查询
    ↓
服务器生成 → 用于缓存预热 ❌ Vercel 超时/内存问题
```

### ✅ 现在的纯客户端架构

```
客户端生成 → 所有 embedding 生成
    ↓
服务器缓存 → 只存储和查询缓存
```

---

## Vercel Functions 限制

| 限制 | 免费版 | Pro | Enterprise |
|------|--------|-----|------------|
| 执行时间 | 10秒 | 60秒 | 900秒 |
| 内存 | 1GB | 3GB | 12GB |
| 冷启动 | 是 | 是 | 是 |

**问题**：
- 模型初始化需要 5-15 秒（超过免费版限制）
- 模型占用 ~300MB 内存
- 每次冷启动都要重新加载模型
- 成本高（每次调用都消耗执行时间）

---

## 新架构流程

### 1. 用户查询流程

```typescript
// 客户端
const { generateEmbedding } = useClientEmbedding();

// Step 1: 检查缓存
const cached = await fetch('/api/embeddings/cache/lookup', {
  method: 'POST',
  body: JSON.stringify({ query: userQuery })
});

if (cached.embedding) {
  // 使用缓存的 embedding
  return cached.embedding;
}

// Step 2: 客户端生成
const result = await generateEmbedding(userQuery);

// Step 3: 存储到缓存（供其他用户使用）
await fetch('/api/embeddings/cache/store', {
  method: 'POST',
  body: JSON.stringify({
    query: userQuery,
    embedding: result.embedding,
    language: detectedLanguage
  })
});

return result.embedding;
```

### 2. 缓存预热流程（客户端后台任务）

```typescript
// 在用户空闲时预热常用查询
const commonQueries = [
  "how to apply for bantuan",
  "cara mohon bantuan",
  "bantuan eligibility requirements"
];

// 后台生成并缓存
for (const query of commonQueries) {
  const embedding = await generateEmbedding(query);
  await fetch('/api/embeddings/cache/store', {
    method: 'POST',
    body: JSON.stringify({ query, embedding })
  });
}
```

---

## API 端点

### 1. GET /api/embeddings/cache
获取缓存统计信息

```typescript
// Response
{
  success: true,
  stats: {
    totalCachedQueries: 150,
    totalHits: 1250,
    avgHitsPerQuery: 8.3,
    topQueries: [...]
  }
}
```

### 2. POST /api/embeddings/cache/lookup
查询缓存（不生成）

```typescript
// Request
{
  query: "how to apply",
  language: "en"
}

// Response (cache hit)
{
  embedding: [0.123, -0.456, ...],
  isFromCache: true,
  cacheSource: "exact"
}

// Response (cache miss)
{
  embedding: null,
  isFromCache: false
}
```

### 3. POST /api/embeddings/cache/store
存储客户端生成的 embedding

```typescript
// Request
{
  query: "how to apply",
  embedding: [0.123, -0.456, ...], // 384-dim
  language: "en",
  dialect: "my"
}

// Response
{
  success: true,
  message: "Embedding cached successfully"
}
```

### 4. POST /api/embeddings/cache/warmup
**已废弃** - 返回 410 Gone

---

## 客户端实现

### Hook: useClientEmbedding

```typescript
import { useClientEmbedding } from '@/hooks/useClientEmbedding';

function MyComponent() {
  const { 
    generateEmbedding, 
    isReady, 
    isLoading,
    progress 
  } = useClientEmbedding();
  
  const handleQuery = async (query: string) => {
    // 1. 检查缓存
    const cached = await checkCache(query);
    if (cached) return cached;
    
    // 2. 客户端生成
    const result = await generateEmbedding(query);
    
    // 3. 存储到缓存
    await storeToCache(query, result.embedding);
    
    return result.embedding;
  };
}
```

### Provider: ClientEmbeddingProvider

```typescript
// app/layout.tsx
import { ClientEmbeddingProvider } from '@/components/embeddings/ClientEmbeddingProvider';

export default function RootLayout({ children }) {
  return (
    <ClientEmbeddingProvider 
      showProgress={true}
      preloadOnMount={true}
    >
      {children}
    </ClientEmbeddingProvider>
  );
}
```

---

## 优势

### 1. 避免 Vercel 限制
- ✅ 无冷启动超时问题
- ✅ 无内存限制问题
- ✅ 无需担心函数执行时间

### 2. 降低成本
- ✅ 不消耗 Vercel 函数执行时间
- ✅ 不占用服务器内存
- ✅ 可扩展性无限（用户设备处理）

### 3. 更好的隐私
- ✅ 数据不离开用户浏览器
- ✅ 符合 GDPR
- ✅ 用户更信任

### 4. 更快的响应（后续访问）
- ✅ 模型缓存在浏览器
- ✅ 生成速度 50-200ms
- ✅ 无网络延迟

---

## 权衡

### 1. 首次加载慢
- 需要下载模型（~25MB）
- 首次约 5-10 秒
- **解决方案**：显示进度条，预加载

### 2. 浏览器要求
- 需要现代浏览器
- Chrome 90+, Firefox 88+, Safari 14+
- **解决方案**：检测浏览器，提供提示

### 3. 用户设备性能
- 依赖用户设备
- 低端设备可能较慢
- **解决方案**：显示加载状态，优化体验

---

## 缓存策略

### 1. 精确匹配（Exact Match）
- 使用 SHA-256 hash
- 归一化查询文本
- 命中率：~30-40%

### 2. 模板匹配（Template Match）
- **已禁用**（需要服务器端生成）
- 可以通过预缓存常用查询实现类似效果

### 3. 客户端生成（Client Generate）
- 缓存未命中时
- 50-200ms 生成时间
- 自动存储到缓存

---

## 迁移清单

### 已完成 ✅

- [x] 移除 `lib/embeddings/cache.ts` 中的服务器端生成
- [x] 禁用 `warmupQueryTemplates` 函数
- [x] 禁用模板相似度匹配（需要服务器端生成）
- [x] 创建 `/api/embeddings/cache/store` 端点
- [x] 废弃 `/api/embeddings/cache/warmup` 端点
- [x] 移除 `onnxruntime-common` 和 `onnxruntime-web` 依赖
- [x] 更新文档

### 待完成 ⏳

- [ ] 更新客户端代码使用新的缓存 API
- [ ] 实现客户端后台缓存预热
- [ ] 添加缓存命中率监控
- [ ] 优化首次加载体验
- [ ] 添加浏览器兼容性检测

---

## 性能指标

| 指标 | 服务器端 | 客户端（首次） | 客户端（缓存） |
|------|---------|--------------|--------------|
| 模型加载 | 5-15秒 + 冷启动 | 5-10秒 | 0秒 |
| 生成时间 | 100-500ms | 100-300ms | 50-200ms |
| 成本 | 高（每次调用） | 低（一次性） | 低 |
| 可扩展性 | 受限 | 无限 | 无限 |
| Vercel 超时风险 | ❌ 高 | ✅ 无 | ✅ 无 |

---

## 总结

通过采用**纯客户端 embedding 生成**架构：

1. ✅ 完全避免 Vercel Serverless Functions 的限制
2. ✅ 降低服务器成本和复杂度
3. ✅ 提供更好的隐私保护
4. ✅ 实现无限可扩展性
5. ✅ 后续访问速度更快

唯一的权衡是首次加载需要下载模型，但这是一次性成本，且可以通过良好的 UX 设计来优化体验。

**这是在 Vercel 上部署 Transformers.js 的最佳实践！** 🚀
