# ChatInterface Agent 调用流程详解

## 概述

ChatInterface 并不是传统意义上的"agent"架构，而是一个**完整的 NLP + RAG 管道**。它通过多个步骤处理用户查询，每个步骤都有专门的功能。

---

## 完整调用流程图

```
用户输入
    ↓
[1] 语言检测 (Language Detection)
    ↓
[2] 查询优化 (Query Optimization) - 自动
    ↓
[3] 生成 Embedding
    ↓
[4] 混合搜索 (Hybrid Search)
    ↓
[5] 重排序 (Reranking)
    ↓
[6] 构建上下文 (Context Building)
    ↓
[7] LLM 生成回答 (Generation)
    ↓
[8] 后处理增强 (Post-processing)
    ↓
显示给用户
```

---

## 详细步骤解析

### 步骤 0: 用户发送消息

**位置:** `ChatInterface.tsx` → `handleSendMessage()`

```typescript
const handleSendMessage = async () => {
  if (!input.trim() || sending) return;
  
  const userMessageContent = input.trim();
  setInput('');
  setSending(true);
  
  // 重置并显示管道进度
  resetSteps();
  showPipelineUI();
  
  // 开始处理...
}
```

**作用:**
- 验证输入
- 显示管道进度 UI
- 开始处理流程

---

### 步骤 1: 语言和方言检测

**位置:** `ChatInterface.tsx` → `handleSendMessage()`

**Hook:** `useLanguageDetection` → `detectLanguage()`

**API 调用:** `POST /api/nlp/detect`

**后端实现:** `lib/nlp/detect-language.ts` → `detectLanguage()`

```typescript
// 步骤 1: 语言 & 方言检测
updatePipelineStep(1, 'active');

const detected = await detectLanguage(userMessageContent);

if (detected) {
  updatePipelineStep(1, 'completed', `${getLanguageName(detected.language)}${detected.dialect ? ` (${detected.dialect})` : ''}`);
}
```

**使用的模型:** LFM 2.5 1.2B Thinking (快速分类模型)

**输出示例:**
```json
{
  "language": "ms",
  "dialect": "sabah",
  "confidence": 0.92,
  "explanation": "Detected Malay language with Sabah dialect features"
}
```

**重构改进:**
- ✅ 使用 Zod schema 自动验证
- ✅ 使用 `createStructuredModel()` 替代手动 JSON 解析
- ✅ 添加 `withRetry()` 处理速率限制

---

### 步骤 2: 方言规范化 (可选)

**位置:** `ChatInterface.tsx` → `handleSendMessage()`

**API 调用:** `POST /api/nlp/normalize`

**后端实现:** `lib/nlp/normalize-dialect.ts` → `normalizeDialect()`

```typescript
// 步骤 2: 方言规范化 (如果检测到方言)
if (detectedLanguage?.dialect) {
  updatePipelineStep(2, 'active');
  
  const normResult = await nlpApi.normalizeDialect(
    userMessageContent,
    detectedLanguage.language,
    detectedLanguage.dialect
  );

  if (normResult.should_normalize && normResult.changes.length > 0) {
    // 显示规范化对话框，等待用户确认
    setNormalizationResult(normResult);
    setShowNormalizationDialog(true);
    return; // 暂停，等待用户决定
  }
}
```

**使用的模型:** LFM 2.5 1.2B Thinking

**输出示例:**
```json
{
  "normalized": "Saya mahu pergi ke kedai",
  "changes": [
    {
      "from": "Sayo",
      "to": "Saya",
      "reason": "Kelantan dialect → Standard Malay"
    },
    {
      "from": "nak",
      "to": "mahu",
      "reason": "Informal → Formal"
    }
  ],
  "confidence": 0.95,
  "should_normalize": true
}
```

**用户交互:**
- 如果需要规范化，显示 `NormalizationDialog`
- 用户可以选择：
  - ✅ 确认使用规范化文本
  - ❌ 跳过，使用原始文本

**重构改进:**
- ✅ 使用 Zod schema 自动验证
- ✅ 删除了 80+ 行手动解析代码

---

### 步骤 3-7: RAG 管道

**位置:** `ChatInterface.tsx` → `continueWithRAG()`

根据用户设置，选择流式或非流式 RAG：

```typescript
async function continueWithRAG(queryText: string, conversationIdParam?: string) {
  if (streamingEnabled) {
    await continueWithStreamingRAG(queryText, conversationIdParam);
  } else {
    await continueWithNonStreamingRAG(queryText, conversationIdParam);
  }
}
```

---

#### 流式 RAG (推荐)

**位置:** `ChatInterface.tsx` → `continueWithStreamingRAG()`

**Hook:** `useStreamingRAG` → `executeStreamingQuery()`

**API 调用:** `POST /api/chat/query-stream` (Server-Sent Events)

**后端实现:** `app/api/chat/query-stream/route.ts`

```typescript
async function continueWithStreamingRAG(queryText: string, conversationIdParam?: string) {
  // 步骤 3: 生成 Embedding
  updatePipelineStep(3, 'active');
  const embedding = await generateEmbedding(queryText);
  updatePipelineStep(3, 'completed');
  
  // 创建临时流式消息
  const tempStreamingMessage = {
    id: `streaming-${Date.now()}`,
    role: 'assistant',
    content: '',
    isStreaming: true
  };
  addMessage(tempStreamingMessage);
  
  // 执行流式查询
  const result = await executeStreamingQuery(
    convId,
    queryText,
    embedding,
    modelMode
  );
  
  // 替换临时消息为最终消息
  setMessages(prev => prev.filter(m => !m.id.startsWith('streaming-')));
  addMessages([result.userMessage, result.assistantMessage]);
}
```

**SSE 事件流:**

```typescript
// useStreamingRAG.ts 处理 SSE 事件
switch (event) {
  case 'status':
    // 更新管道状态
    setCurrentStatus(data);
    options.onStatus?.(data);
    break;

  case 'sources':
    // 接收检索到的文档
    sources = data.chunks;
    options.onSources?.(sources);
    break;

  case 'chunk':
    // 实时接收 LLM 生成的内容
    setStreamedContent(prev => prev + data.content);
    options.onChunk?.(data.content);
    break;

  case 'confidence':
    // 接收置信度分数
    confidence = data.score;
    options.onConfidence?.(confidence);
    break;

  case 'assistant_message':
    // 接收最终保存的消息
    assistantMessage = data.message;
    break;

  case 'done':
    // 完成
    options.onComplete?.(assistantMessage);
    break;
}
```

---

#### 后端流式 RAG 详细流程

**文件:** `app/api/chat/query-stream/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      // 步骤 1: 保存用户消息
      sendEvent('status', { step: 'saving_user_message' });
      const userMessage = await supabase.from('chat_messages').insert(...);
      sendEvent('user_message', { message: userMessage });
      
      // 步骤 4: 混合搜索 (粗排)
      sendEvent('status', { step: 'searching' });
      const coarseCandidates = await supabase.rpc('search_similar_chunks_coarse', {
        query_embedding,
        match_threshold: 0.5,
        match_count: 30,  // 获取 30 个候选
      });
      
      // 步骤 5: 重排序 (精排)
      sendEvent('status', { step: 'reranking' });
      const queryLargeEmbedding = await generateLargeEmbedding(query);
      
      retrievedChunks = coarseCandidates
        .map(candidate => ({
          ...candidate,
          similarity: cosineSimilarity(queryLargeEmbedding, candidate.embedding_large)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);  // 取前 5 个
      
      sendEvent('sources', { chunks: retrievedChunks });
      
      // 步骤 6: 构建上下文
      sendEvent('status', { step: 'building_context' });
      
      // 6a. 构建结构化记忆 (对话历史)
      const structuredMemory = await buildStructuredMemory(user.id, conversation_id, 4000);
      
      // 6b. 格式化检索到的文档
      const context = retrievedChunks
        .map((chunk, idx) => `[Document ${idx + 1}: ${chunk.title}]\n${chunk.chunk_text}\n`)
        .join('\n---\n\n');
      
      // 6c. 构建系统提示词
      const systemPrompt = `You are a helpful government policy assistant...
${memoryContext}
Context Documents:
${context}`;
      
      // 步骤 7: 流式生成回答
      sendEvent('status', { step: 'generating' });
      
      // 创建带重试逻辑的模型
      const baseModel = modelMode === 'mini'
        ? Models.trinityMini({ temperature: 0.7, maxTokens: 2048 })
        : Models.trinityLarge({ temperature: 0.7, maxTokens: 2048 });
      
      const model = withRetry(baseModel);  // ✅ 重构改进：添加重试逻辑
      
      // 重试循环 (最多 3 次)
      let retryCount = 0;
      while (retryCount < 3) {
        try {
          const stream = await model.stream(messages);
          
          for await (const chunk of stream) {
            fullResponse += chunk.content;
            sendEvent('chunk', { content: chunk.content });  // 实时发送给前端
          }
          
          sendEvent('status', { step: 'complete' });
          break;  // 成功，退出重试循环
          
        } catch (llmError) {
          retryCount++;
          
          // 检查是否是速率限制错误
          const isRateLimit = llmError?.message?.includes('429');
          
          if (isRateLimit && retryCount < 3) {
            // 指数退避：2^n 秒
            const delayMs = Math.pow(2, retryCount) * 1000;
            sendEvent('status', { 
              step: 'rate_limited', 
              message: `Rate limited, retrying in ${delayMs / 1000}s...` 
            });
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;  // 重试
          }
          
          // 非速率限制错误或达到最大重试次数
          fullResponse = "I apologize, but I'm experiencing high demand...";
          sendEvent('chunk', { content: fullResponse });
          break;
        }
      }
      
      // 步骤 8: 计算置信度分数
      const confidenceScore = calculateConfidenceScore(retrievedChunks, fullResponse, query);
      sendEvent('confidence', { score: confidenceScore });
      
      // 步骤 9: 保存助手消息
      const assistantMessage = await supabase.from('chat_messages').insert(...);
      sendEvent('assistant_message', { message: assistantMessage });
      
      // 步骤 10: 更新对话标题 (如果是第一条消息)
      // 步骤 11: 跟踪使用量
      
      sendEvent('done', { success: true });
      controller.close();
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**重构改进:**
- ✅ 添加 `withRetry()` 包装模型
- ✅ 实现手动重试循环处理流式错误
- ✅ 指数退避策略 (2^n 秒)
- ✅ 检测速率限制错误 (429)
- ✅ 用户友好的错误消息

---

### 步骤 8: 后处理增强

**位置:** `ChatInterface.tsx` → 消息显示后

用户可以对助手回答进行多种增强处理：

#### 8a. 简化 (Simplify)

**Hook:** `useMessageEnhancements` → `simplifyMessage()`

**API:** `POST /api/nlp/simplify`

**后端:** `lib/nlp/simplify.ts` → `simplifyText()`

**模型:** Trinity Mini

```typescript
<button onClick={() => simplifyMessage(message.id, message.content)}>
  Simplify Professional Words
</button>
```

**输出:**
- 简化后的文本
- 困难词汇列表（带解释）
- 可读性分数对比

**重构改进:**
- ✅ 修复了 JSON 解析错误
- ✅ 删除了 130+ 行 JSON 修复代码
- ✅ 使用 Zod schema 自动验证

---

#### 8b. 总结 (Summarize)

**Hook:** `useMessageEnhancements` → `summarizeMessage()`

**API:** `POST /api/nlp/summarize`

**后端:** `lib/nlp/summarize.ts` → `summarizeText()`

**模型:** Trinity Mini

```typescript
<button onClick={() => summarizeMessage(message.id, message.content, 'bullet_points')}>
  Summarize in Point Form
</button>
```

**输出:**
- 要点列表
- 行动项列表
- 字数减少百分比

**重构改进:**
- ✅ 使用结构化输出
- ✅ 删除了 80+ 行解析代码
- ✅ 保留了分层总结逻辑（长文本）

---

#### 8c. 翻译 (Translate)

**Hook:** `useMessageEnhancements` → `translateMessage()`

**API:** `POST /api/nlp/translate`

**后端:** `lib/nlp/translate.ts` → `translateToDialect()`

**模型:** Trinity Mini

```typescript
<button onClick={() => translateMessage(
  message.id, 
  message.content, 
  detectedLanguage.language, 
  detectedLanguage.dialect
)}>
  Translate to {detectedLanguage.dialect}
</button>
```

**输出:**
- 翻译后的文本
- 置信度分数
- 可选的替代翻译

**重构改进:**
- ✅ 使用结构化输出
- ✅ 删除了 70+ 行解析代码

---

#### 8d. 语音输出 (Voice Output)

**Hook:** `useVoiceOutput` → `speak()`

**实现:** 浏览器 Web Speech API

```typescript
<button onClick={() => handleVoiceOutput(message.id, content)}>
  Play Response
</button>
```

**功能:**
- 自动检测语言（从文本内容）
- 支持多语言 TTS
- 显示缺失语音包警告

---

## 关键技术点

### 1. 混合搜索 (Hybrid Search)

**两阶段检索:**

```
第一阶段 (粗排):
- 使用小型 embedding (384 维)
- 快速检索 30 个候选
- 使用 Supabase RPC 函数

第二阶段 (精排):
- 使用大型 embedding (1024 维)
- 重新计算相似度
- 排序并取前 5 个
```

**为什么这样做？**
- 小型 embedding 快速筛选
- 大型 embedding 精确排序
- 平衡速度和准确性

---

### 2. 结构化记忆 (Structured Memory)

**文件:** `lib/nlp/structured-memory.ts`

**功能:**
- 从对话历史中提取关键信息
- 限制 token 数量（避免超出上下文窗口）
- 格式化为 LLM 可理解的格式

**示例:**
```
Previous conversation context:
- User asked about: healthcare subsidies
- User's situation: low-income family
- Documents discussed: Healthcare Assistance Program
```

---

### 3. 置信度评分 (Confidence Scoring)

**文件:** `lib/nlp/confidence-score.ts`

**计算因素:**
1. **检索质量** (40%)
   - 文档相似度
   - 文档数量
   
2. **回答质量** (30%)
   - 是否引用文档
   - 回答长度
   
3. **查询匹配** (30%)
   - 查询词在回答中的覆盖率

**输出:**
```json
{
  "overall": 0.85,
  "level": "high",
  "explanation": "High confidence based on strong document matches and comprehensive answer"
}
```

---

### 4. 重试逻辑 (Retry Logic)

**实现:** `lib/langchain/structured.ts` → `withRetry()`

```typescript
export function withRetry<T>(model: T): T {
  return (model as any).withRetry({
    stopAfterAttempt: 3,
    onFailedAttempt: (error: any) => {
      if (error.message?.includes('429')) {
        // 指数退避
        return { 
          delay: Math.pow(2, error.attemptNumber) * 1000 
        };
      }
    },
  });
}
```

**退避时间:**
- 第 1 次重试: 2 秒
- 第 2 次重试: 4 秒
- 第 3 次重试: 8 秒

---

## 数据流图

```
用户输入: "Sayo nak tahu pasal bantuan banjir"
    ↓
[语言检测]
    → 检测到: Malay (Kelantan dialect)
    ↓
[方言规范化]
    → 规范化为: "Saya mahu tahu tentang bantuan banjir"
    → 用户确认使用规范化文本
    ↓
[生成 Embedding]
    → 小型: [0.123, -0.456, ...] (384 维)
    → 大型: [0.789, -0.234, ...] (1024 维)
    ↓
[混合搜索]
    → 粗排: 30 个候选文档
    → 精排: 5 个最相关文档
    ↓
[构建上下文]
    → 对话历史: "User previously asked about..."
    → 检索文档: "[Document 1: Flood Relief Program]..."
    ↓
[LLM 生成]
    → 模型: Trinity Large
    → 流式输出: "Based on Document 1, the flood relief..."
    ↓
[后处理]
    → 计算置信度: 0.92 (high)
    → 保存消息到数据库
    ↓
[用户增强]
    → 用户点击"Simplify": 简化专业术语
    → 用户点击"Translate to Sabah": 翻译为 Sabah 方言
    → 用户点击"Play Response": 语音播放
```

---

## 与传统 Agent 的区别

### 传统 Agent (如 LangGraph)

```
用户输入
    ↓
Agent 决策循环:
    ├─ 调用工具 1 (web search)
    ├─ 分析结果
    ├─ 调用工具 2 (calculator)
    ├─ 分析结果
    └─ 生成最终回答
```

**特点:**
- 动态决策
- 多步推理
- 工具调用链

### 当前实现 (固定管道)

```
用户输入
    ↓
固定步骤:
    1. 语言检测
    2. 方言规范化
    3. Embedding
    4. 搜索
    5. 重排序
    6. 上下文构建
    7. 生成
    8. 后处理
```

**特点:**
- 预定义流程
- 可预测性高
- 针对特定场景优化

---

## 为什么不使用完整的 Agent 架构？

### 当前方法的优势

1. **可预测性**
   - 每个步骤都是确定的
   - 容易调试和监控
   - 用户体验一致

2. **性能**
   - 无需多次 LLM 调用
   - 流程优化
   - 延迟更低

3. **成本**
   - 固定的 token 使用
   - 无额外的决策开销

4. **简单性**
   - 易于理解和维护
   - 无需复杂的状态管理

### 何时需要 Agent 架构？

如果需要以下功能，可以考虑升级：

1. **动态工具选择**
   - 根据查询决定是否搜索网络
   - 根据需要调用计算器
   - 多步骤推理

2. **复杂决策**
   - "我需要更多信息，让我先搜索..."
   - "这个答案不够准确，让我换个方式..."

3. **交互式对话**
   - "我需要问你几个问题..."
   - "让我确认一下你的情况..."

---

## 总结

当前的 ChatInterface 实现是一个**高度优化的固定管道**，而不是传统的 agent 架构。它通过以下方式提供智能体验：

✅ **智能语言处理**
- 自动检测语言和方言
- 可选的方言规范化
- 多语言支持

✅ **高质量检索**
- 混合搜索（粗排 + 精排）
- 结构化记忆
- 置信度评分

✅ **可靠的生成**
- 流式输出
- 重试逻辑
- 速率限制处理

✅ **丰富的后处理**
- 文本简化
- 内容总结
- 方言翻译
- 语音输出

这种设计在**特定领域（政府政策问答）**中表现出色，提供了可预测、可靠、高性能的用户体验。

---

*文档创建时间: 2026-03-08*
*重构版本: Phase 3 完成*
