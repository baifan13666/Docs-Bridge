# 客户端 Embedding 生成指南

## 概述

现在 embedding 生成已经迁移到客户端（浏览器）运行，使用 Web Worker 来避免阻塞主线程。

## 架构

```
用户浏览器
    ↓
React Component (使用 useClientEmbedding hook)
    ↓
Web Worker (lib/embeddings/worker.ts)
    ↓
@huggingface/transformers (在浏览器中运行)
    ↓
bge-small-en-v1.5 模型 (384维)
    ↓
返回 embedding
```

## 优势

### ✅ 相比服务器端的优势

1. **无服务器成本** - 在用户浏览器中运行，不占用 Vercel 函数时间
2. **无原生依赖问题** - 浏览器环境统一，没有 `libonnxruntime.so` 错误
3. **更好的隐私** - 数据不离开用户浏览器
4. **可扩展性** - 不受服务器资源限制

### ⚠️ 权衡

1. **首次加载慢** - 需要下载模型（~25MB，首次约 5-10 秒）
2. **浏览器要求** - 需要现代浏览器（Chrome 90+, Firefox 88+, Safari 14+）
3. **用户设备性能** - 依赖用户设备性能

## 使用方法

### 1. 在组件中使用

```typescript
'use client';

import { useClientEmbedding } from '@/hooks/useClientEmbedding';

export default function MyComponent() {
  const { generateEmbedding, isReady, isLoading, progress, error } = useClientEmbedding();
  
  const handleGenerate = async () => {
    try {
      const result = await generateEmbedding('your text here');
      console.log('Embedding:', result.embedding);
      console.log('Dimension:', result.dimension); // 384
    } catch (err) {
      console.error('Failed to generate embedding:', err);
    }
  };
  
  return (
    <div>
      {!isReady && <p>Loading model...</p>}
      {progress && <p>Progress: {Math.round(progress.progress * 100)}%</p>}
      {error && <p>Error: {error}</p>}
      <button onClick={handleGenerate} disabled={!isReady || isLoading}>
        Generate Embedding
      </button>
    </div>
  );
}
```

### 2. 使用 Provider（推荐）

```typescript
// app/layout.tsx
import { ClientEmbeddingProvider } from '@/components/embeddings/ClientEmbeddingProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ClientEmbeddingProvider showProgress={true}>
          {children}
        </ClientEmbeddingProvider>
      </body>
    </html>
  );
}

// 在任何子组件中使用
import { useClientEmbeddingContext } from '@/components/embeddings/ClientEmbeddingProvider';

export default function MyComponent() {
  const { generateEmbedding } = useClientEmbeddingContext();
  
  // 使用 generateEmbedding...
}
```

## 文件结构

```
lib/embeddings/
├── worker.ts              # Web Worker 实现
├── query.ts               # 旧的服务器端实现（保留作为参考）
└── cache.ts               # 缓存逻辑（仍然使用）

hooks/
└── useClientEmbedding.ts  # React Hook

components/embeddings/
└── ClientEmbeddingProvider.tsx  # Context Provider

app/api/embeddings/
├── route.ts               # 旧的服务器端 API（已弃用）
└── client/route.ts        # 客户端 fallback（返回错误）
```

## 迁移步骤

### 从服务器端迁移到客户端

1. **更新组件**

   ```typescript
   // 旧的方式（服务器端）
   const response = await fetch('/api/embeddings', {
     method: 'POST',
     body: JSON.stringify({ text }),
   });
   const { embedding } = await response.json();
   
   // 新的方式（客户端）
   const { generateEmbedding } = useClientEmbedding();
   const { embedding } = await generateEmbedding(text);
   ```

2. **添加 Provider**

   在 `app/layout.tsx` 中包裹你的应用：
   
   ```typescript
   <ClientEmbeddingProvider>
     {children}
   </ClientEmbeddingProvider>
   ```

3. **移除服务器端调用**

   搜索并替换所有 `/api/embeddings` 调用为客户端 hook。

## 性能优化

### 模型缓存

模型会自动缓存在浏览器中（IndexedDB），后续访问会直接从缓存加载。

### 预加载模型

在用户可能需要之前预加载模型：

```typescript
useEffect(() => {
  // 预加载模型
  generateEmbedding('warmup').catch(() => {
    // 忽略错误，只是为了预加载
  });
}, []);
```

### 批量处理

如果需要生成多个 embedding，可以串行处理：

```typescript
const embeddings = [];
for (const text of texts) {
  const result = await generateEmbedding(text);
  embeddings.push(result.embedding);
}
```

## 浏览器兼容性

### 支持的浏览器

- ✅ Chrome 90+
- ✅ Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Opera 76+

### 检测支持

```typescript
function isWebWorkerSupported() {
  return typeof Worker !== 'undefined';
}

function isTransformersJSSupported() {
  // 检查 WebAssembly 支持
  return typeof WebAssembly !== 'undefined';
}
```

## 故障排除

### 问题：模型下载失败

**原因**: 网络问题或 CDN 不可用

**解决方案**:
```typescript
// 在 worker.ts 中配置自定义 CDN
env.remoteHost = 'https://your-cdn.com/models/';
```

### 问题：内存不足

**原因**: 设备内存不足

**解决方案**:
- 使用更小的模型
- 或者回退到服务器端生成

### 问题：Web Worker 不工作

**原因**: 浏览器不支持或被 CSP 阻止

**解决方案**:
```typescript
// 检测并回退
if (!isWebWorkerSupported()) {
  // 使用服务器端 API
  const response = await fetch('/api/embeddings/fallback', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}
```

## 与缓存集成

客户端 embedding 仍然可以使用服务器端缓存：

```typescript
// 1. 检查缓存
const cached = await fetch('/api/embeddings/cache', {
  method: 'POST',
  body: JSON.stringify({ text }),
});

if (cached.ok) {
  const { embedding } = await cached.json();
  return embedding;
}

// 2. 生成新的 embedding（客户端）
const { embedding } = await generateEmbedding(text);

// 3. 保存到缓存
await fetch('/api/embeddings/cache', {
  method: 'PUT',
  body: JSON.stringify({ text, embedding }),
});
```

## 配置

### next.config.ts

```typescript
webpack: (config) => {
  config.resolve.alias = {
    ...config.resolve.alias,
    sharp$: false,
    "onnxruntime-node$": false,
  };
  return config;
}
```

这个配置确保 webpack 不会尝试打包原生模块到浏览器 bundle 中。

### package.json

不再需要 npm overrides！客户端运行不会尝试安装 `onnxruntime-node`。

```json
{
  "dependencies": {
    "@huggingface/transformers": "^3.8.1"
  }
}
```

## 总结

| 方面 | 服务器端 | 客户端 |
|------|---------|--------|
| 成本 | 高（Vercel 函数） | 低（用户设备） |
| 速度（首次） | 5-15秒 | 5-10秒 |
| 速度（后续） | 100-500ms | 50-200ms |
| 隐私 | 数据发送到服务器 | 数据不离开浏览器 |
| 兼容性 | 所有设备 | 现代浏览器 |
| 依赖问题 | 有（原生库） | 无 |

**推荐**: 使用客户端 embedding 作为主要方案，服务器端作为 fallback。
