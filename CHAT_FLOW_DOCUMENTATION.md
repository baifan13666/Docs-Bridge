# Chat Flow Documentation

## Complete Message Flow (User → AI Response)

This document explains the entire chat flow from when a user sends a message to when they receive an AI response.

---

## Flow Overview

```
User Input → ChatInterface → Client Embedding → Streaming API → Database → UI Update
```

---

## Detailed Step-by-Step Flow

### 1. User Sends Message
**File**: `components/chat/ChatInterface.tsx`
**Function**: `handleSendMessage()`

```typescript
// User types message and clicks send
const userMessageContent = input.trim();
setInput('');
setSending(true);
```

**What happens**:
- Validates input is not empty
- Checks if guest user has already used their free query
- Clears input field
- Shows pipeline UI with loading steps

---

### 2. Language Detection (Client-Side)
**File**: `components/chat/ChatInterface.tsx`
**Hook**: `useLanguageDetection`
**API**: `/api/nlp/detect`

```typescript
// Detect language of user input
pipeline.updateStep(1, 'active');
const detected = await detectLanguage(userMessageContent);

if (detected) {
  pipeline.updateStep(1, 'completed', `${getLanguageName(detected.language)}${detected.dialect ? ` (${detected.dialect})` : ''}`);
} else {
  pipeline.updateStep(1, 'skipped');
}
```

**What happens**:
- Calls `/api/nlp/detect` to detect language and dialect
- Updates pipeline step 1 (Language Detection)
- Stores detected language for later use (translation, voice output)
- Supports: English, Malay, Chinese, Tamil, Tagalog, Indonesian
- Detects dialects (e.g., Penang Hokkien, Johor Malay)

---

### 3. Query Optimization (Client-Side)
**File**: `components/chat/ChatInterface.tsx`
**API**: `/api/nlp/rewrite`

```typescript
// Optimize query for better retrieval
pipeline.updateStep(2, 'active');

let optimizedQuery = userMessageContent;
try {
  const rewriteResult = await nlpApi.rewriteQuery(
    userMessageContent,
    detectedLanguage?.language || 'en',
    detectedLanguage?.dialect,
    'en'
  );

  if (rewriteResult.confidence >= 0.7 && rewriteResult.rewritten !== userMessageContent) {
    optimizedQuery = rewriteResult.rewritten;
    pipeline.updateStep(2, 'completed', `+${rewriteResult.added_keywords.length} keywords`);
  } else {
    pipeline.updateStep(2, 'completed', 'Already optimal');
  }
} catch (error) {
  console.error('Query optimization failed:', error);
  pipeline.updateStep(2, 'skipped');
}
```

**What happens**:
- Calls `/api/nlp/rewrite` to optimize query for semantic search
- Adds relevant keywords and expands abbreviations
- Translates to English if needed (for better retrieval)
- Only uses optimized query if confidence >= 0.7
- Updates pipeline step 2 (Query Optimization)
- Falls back to original query if optimization fails

**Note**: Original query is displayed to user, optimized query is used for retrieval

---

### 4. Generate Embedding (Client-Side)
**File**: `components/chat/ChatInterface.tsx`
**Hook**: `useClientEmbedding`
**Function**: `continueWithStreamingRAG()`

```typescript
// Generate embedding for optimized query
pipeline.updateStep(3, 'active');
const embeddingResult = await generateEmbeddingWithCache(queryText);
const embedding = embeddingResult.embedding;
pipeline.updateStep(3, 'completed');
```

**What happens**:
- Uses Transformers.js (`Xenova/multilingual-e5-small`) to generate 384-dim embedding
- Runs in Web Worker (non-blocking, doesn't freeze UI)
- Caches embedding in database via API for future use
- Updates pipeline step 3 (Embedding Generation)
- Embedding is sent to server for semantic search

**Architecture**: 
- Client-only embedding (no server-side embedding unless fallback)
- Model loaded once and reused for all queries
- Typical generation time: 100-300ms on modern devices after model loaded

**Why client-side?**
- Vercel serverless functions have cold start issues
- Client-side is faster after initial model load
- Reduces server costs and load

**Fallback**: If client-side generation fails, server will generate using external API

---

### 5. Create Conversation (if needed)
**File**: `components/chat/ChatInterface.tsx`
**Function**: `continueWithStreamingRAG()`

```typescript
let convId = conversationIdParam || currentConversationId;

// If no conversation ID, create one
if (!convId) {
  if (isAuthenticated) {
    // Create new conversation for authenticated users
    const response = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Chat' })
    });
    
    const data = await response.json();
    convId = data.conversation.id;
    setCurrentConversationId(convId);
  } else {
    // Use temporary ID for guest users
    convId = `guest-${Date.now()}`;
  }
}
```

**What happens**:
- Checks if conversation ID exists
- For authenticated users: Creates new conversation in database
- For guest users: Uses temporary ID (not saved to database)
- Updates current conversation ID in state

---

### 6. Create Streaming Message
**File**: `components/chat/ChatInterface.tsx`

```typescript
// Create temporary streaming message
const tempStreamingMessage = {
  id: `streaming-${Date.now()}`,
  role: 'assistant',
  content: '',
  created_at: new Date().toISOString(),
  isStreaming: true
};

addMessage(tempStreamingMessage);
```

**What happens**:
- Creates temporary message with empty content
- Shows "Thinking..." indicator with blinking cursor
- Will be replaced with final message when streaming completes
- Allows UI to show AI is working

---

### 7. Execute Streaming Query
**File**: `hooks/useStreamingRAG.ts`
**Function**: `executeStreamingQuery()`

```typescript
// Send request to streaming API
const response = await fetch('/api/chat/query-stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversation_id: convId,
    query: optimizedQuery,           // For retrieval
    query_embedding: embedding,       // For semantic search
    model_mode: modelMode,            // 'standard' or 'mini'
    original_query: userMessageContent // For display
  })
});
```

**What happens**:
- Sends optimized query + embedding to server
- Includes original query for user message display
- Includes model_mode ('standard' or 'mini')
- Opens Server-Sent Events (SSE) stream
- Listens for events: status, user_message, sources, chunk, confidence, assistant_message, done, error

---

### 8. Server-Side Processing
**File**: `app/api/chat/query-stream/route.ts`
**Function**: `POST()`

#### 8.1 Authentication & Rate Limiting
```typescript
// Check if user is authenticated or guest
const { data: { user }, error: authError } = await supabase.auth.getUser();
const isGuest = !user;

if (isGuest) {
  // Rate limit: 1 query per hour per IP
  const clientIP = getClientIP(request);
  const rateLimitResult = checkRateLimit(
    `guest-query:${clientIP}`,
    RATE_LIMITS.GUEST_QUERY
  );
  
  if (!rateLimitResult.allowed) {
    const minutesUntilReset = Math.ceil((rateLimitResult.resetTime - Date.now()) / 60000);
    sendEvent('error', { 
      error: `You've used your free query. Please sign in to continue or try again in ${minutesUntilReset} minutes.`
    });
    controller.close();
    return;
  }
}
```

**What happens**:
- Checks authentication status
- For guest users: Strict rate limiting (1 query per hour per IP)
- For authenticated users: No rate limit at this endpoint (handled by usage tracking)
- Returns error if rate limit exceeded

#### 8.2 Save User Message
```typescript
// Check if this is a guest conversation
const isGuestConversation = conversation_id.startsWith('guest-');

if (!isGuestConversation) {
  // Save user message with DISPLAY query (original user input)
  const { data: savedUserMessage } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id,
      role: 'user',
      content: displayQuery  // Original query for display
    })
    .select()
    .single();
  
  sendEvent('user_message', { message: savedUserMessage });
} else {
  // Guest user: create temporary message object (not saved to DB)
  const userMessage = {
    id: `guest-msg-${Date.now()}`,
    conversation_id,
    role: 'user',
    content: displayQuery,
    created_at: new Date().toISOString()
  };
  
  sendEvent('user_message', { message: userMessage });
}
```

**What happens**:
- Uses `original_query` (displayQuery) for user message content
- For authenticated users: Saves message to database
- For guest users: Creates temporary message object (NOT saved to database)
- Sends user_message event to client

**Note**: Guest messages are NOT saved to database until user signs in and migrates conversation

#### 8.3 Semantic Search
```typescript
// Search knowledge base using client-provided embedding
sendEvent('status', { step: 'searching', message: 'Searching knowledge base...' });

// Use provided embedding or generate server-side as fallback
let queryEmbedding = providedEmbedding;

// Only generate server-side if client didn't provide embedding (empty array or null)
if (!queryEmbedding || queryEmbedding.length === 0) {
  console.log(`[RAG Stream] No embedding provided, generating server-side...`);
  sendEvent('status', { step: 'generating_embedding', message: 'Generating query embedding...' });
  
  try {
    // Use external Hugging Face Inference API (intfloat/e5-small)
    queryEmbedding = await generateQueryEmbedding(query);
    console.log(`[RAG Stream] ✅ Generated ${queryEmbedding.length}-dim embedding server-side`);
    
    // Cache the newly generated embedding for future use
    await cacheEmbedding(query, queryEmbedding);
    console.log(`[RAG Stream] ✅ Cached new embedding`);
  } catch (generateError) {
    console.error(`[RAG Stream] Failed to generate embedding server-side:`, generateError);
    sendEvent('error', { error: 'Failed to generate query embedding. Please try again.' });
    controller.close();
    return;
  }
} else {
  console.log(`[RAG Stream] Using client-provided embedding (${queryEmbedding.length}-dim)`);
}

// For authenticated users: search their knowledge base
if (!isGuest && user) {
  const { data: results } = await supabase
    .rpc('search_chunks_small', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 10,
      user_id_param: user.id,
      active_folder_ids: active_folders
    });
  
  searchResults = results;
} else {
  // Guest users: search public/system documents only
  const { data: results } = await supabase
    .rpc('search_chunks_small', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: 10,
      user_id_param: null,  // No user ID for guests
      active_folder_ids: null
    });
  
  searchResults = results;
}

sendEvent('sources', { chunks: searchResults, count: searchResults.length });
```

**What happens**:
- Uses client-provided embedding (preferred) or generates server-side as fallback
- Server-side generation uses external Hugging Face Inference API (intfloat/multilingual-e5-small)
- E5 model automatically adds "query: " prefix for search queries
- Uses pgvector to find similar document chunks
- For authenticated users: Searches their personal + public documents
- For guest users: Searches only public/system documents
- Returns top 10 most relevant chunks (similarity >= 0.7)
- Sends sources to client for display
- Updates pipeline step 4 (Semantic Search)

**Search function**: `search_chunks_small` uses cosine similarity with pgvector

#### 8.4 Build Context
```typescript
// Build context from retrieved chunks
sendEvent('status', { step: 'building_context', message: 'Building context...' });

// Build structured memory from conversation history (for authenticated users)
let structuredMemory = null;
if (!isGuest && user) {
  structuredMemory = await buildStructuredMemory(user.id, conversation_id, 4000);
}

// Format retrieved chunks into context
let context = '';
if (searchResults && searchResults.length > 0) {
  context = searchResults
    .map((chunk, idx) => `[Document ${idx + 1}: ${chunk.title}]\n${chunk.chunk_text}\n`)
    .join('\n---\n\n');
}

// Build system prompt with context and memory
const systemPrompt = `You are DocsBridge AI, an assistant that helps users understand government policies and services.

${structuredMemory ? `## Conversation Memory\n${formatStructuredMemoryForPrompt(structuredMemory)}\n\n` : ''}

${context ? `## Retrieved Documents\n${context}\n\n` : ''}

Instructions:
- Answer based on the provided documents
- If information is not in the documents, say so clearly
- Be concise and helpful
- Use the user's language when appropriate`;
```

**What happens**:
- Builds structured memory from recent conversation history (last 4000 tokens)
- Formats retrieved chunks into readable context
- Creates system prompt with context + memory
- Updates pipeline step 6 (Building Context)

**Structured Memory**: Includes recent messages, user preferences, and conversation context

#### 8.5 Stream LLM Response
```typescript
// Stream LLM response
sendEvent('status', { step: 'generating', message: 'Generating answer...' });

// Select model based on mode
const model = model_mode === 'mini'
  ? createModelWithHealing(ModelPresets.TRINITY_MINI)
  : createModelWithHealing(ModelPresets.TRINITY_LARGE);

// Stream response using Vercel AI SDK
const result = await streamText({
  model,
  system: systemPrompt,
  prompt: query,  // Optimized query
  temperature: 0.7,
  maxOutputTokens: 2048,
});

// Stream chunks to client in real-time
let fullResponse = '';
for await (const chunk of result.textStream) {
  fullResponse += chunk;
  sendEvent('chunk', { content: chunk });
}
```

**What happens**:
- Selects model based on `model_mode`:
  - `mini`: Faster, cheaper (google/gemini-2.0-flash-exp)
  - `standard`: More accurate (google/gemini-2.0-flash-thinking-exp-1219)
- Uses Vercel AI SDK to stream LLM response
- Sends chunks to client in real-time (SSE)
- Client updates streaming message content as chunks arrive
- Updates pipeline step 7 (Generating Response)
- Includes automatic retry with healing on errors

**Model Healing**: Automatically retries with fallback model if primary fails

#### 8.6 Calculate Confidence & Save
```typescript
// Calculate confidence score
const confidenceScore = calculateConfidenceScore(
  searchResults,
  fullResponse,
  query
);

sendEvent('confidence', { score: confidenceScore });

// Save assistant message (only for authenticated users)
if (!isGuestConversation) {
  const { data: savedAssistantMessage } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id,
      role: 'assistant',
      content: fullResponse,
      sources: searchResults,
      confidence: confidenceScore
    })
    .select()
    .single();

  sendEvent('assistant_message', { message: savedAssistantMessage });
} else {
  // Guest user: create temporary message object (not saved to DB)
  const assistantMessage = {
    id: `guest-msg-${Date.now()}`,
    conversation_id,
    role: 'assistant',
    content: fullResponse,
    sources: searchResults,
    confidence: confidenceScore,
    created_at: new Date().toISOString()
  };
  
  sendEvent('assistant_message', { message: assistantMessage });
}

sendEvent('done', {});
controller.close();
```

**What happens**:
- Calculates confidence based on:
  - Source relevance (similarity scores)
  - Response quality (length, completeness)
  - Query-response alignment
- For authenticated users: Saves assistant message to database
- For guest users: Creates temporary message object (NOT saved)
- Sends final message to client
- Closes SSE stream

**Confidence Levels**:
- High (>= 0.8): Strong evidence from sources
- Medium (0.6-0.8): Moderate evidence
- Low (< 0.6): Weak evidence or no sources

---

### 9. Client Receives Response
**File**: `hooks/useStreamingRAG.ts`

```typescript
// Process SSE events from server
const eventSource = new EventSource(url);

eventSource.addEventListener('status', (e) => {
  const data = JSON.parse(e.data);
  setCurrentStatus(data);
  options.onStatus?.(data);
  
  // Update pipeline steps based on status
  if (data.step === 'searching') {
    // Pipeline step 4
  } else if (data.step === 'building_context') {
    // Pipeline step 6
  } else if (data.step === 'generating') {
    // Pipeline step 7
  }
});

eventSource.addEventListener('user_message', (e) => {
  const data = JSON.parse(e.data);
  userMessage = data.message;
});

eventSource.addEventListener('sources', (e) => {
  const data = JSON.parse(e.data);
  sources = data.chunks;
  options.onSources?.(sources);
});

eventSource.addEventListener('chunk', (e) => {
  const data = JSON.parse(e.data);
  setStreamedContent(prev => prev + data.content);
  options.onChunk?.(data.content);
});

eventSource.addEventListener('confidence', (e) => {
  const data = JSON.parse(e.data);
  confidence = data.score;
  options.onConfidence?.(confidence);
});

eventSource.addEventListener('assistant_message', (e) => {
  const data = JSON.parse(e.data);
  assistantMessage = data.message;
});

eventSource.addEventListener('done', () => {
  options.onComplete?.({ 
    userMessage, 
    assistantMessage: { ...assistantMessage, sources, confidence } 
  });
  eventSource.close();
});

eventSource.addEventListener('error', (e) => {
  const data = JSON.parse(e.data);
  options.onError?.(data.error);
  eventSource.close();
});
```

**What happens**:
- Receives SSE events from server
- Updates pipeline steps based on status events
- Updates streaming message content in real-time
- Displays sources and confidence when available
- Calls completion callback when done

**Event Types**:
- `status`: Pipeline status updates
- `user_message`: User message saved (or created for guest)
- `sources`: Retrieved document chunks
- `chunk`: LLM response chunk (streaming)
- `confidence`: Confidence score
- `assistant_message`: Final assistant message
- `done`: Stream complete
- `error`: Error occurred

---

### 10. Update UI
**File**: `components/chat/ChatInterface.tsx`

```typescript
// Remove temporary streaming message and add final messages
if (result.userMessage && result.assistantMessage) {
  setMessages(prev => prev.filter(m => !m.id.startsWith('streaming-')));
  addMessages([result.userMessage, result.assistantMessage]);
  
  // Auto-translate if dialect detected
  if (detectedLanguage?.dialect && result.assistantMessage.id) {
    setTimeout(() => {
      translateMessage(
        result.assistantMessage!.id,
        result.assistantMessage!.content,
        detectedLanguage.language,
        detectedLanguage.dialect!
      );
    }, 500);
  }
}

// Mark guest as having used their query AFTER seeing the response
if (!isAuthenticated) {
  setGuestQueryUsed();
}

// Hide pipeline UI after delay
pipeline.hidePipelineAfterDelay();
```

**What happens**:
- Removes temporary streaming message
- Adds final user and assistant messages
- Auto-translates if dialect detected (e.g., Penang Hokkien → Standard Malay)
- Marks guest query as used (prevents multiple free queries)
- Hides pipeline UI after 2 seconds

**Auto-translation**: If user speaks a dialect, AI response is automatically translated to that dialect

---

## Pipeline Steps Summary

The pipeline UI shows 7 steps:

1. **Language Detection** (Client) - Detect language and dialect
2. **Query Optimization** (Client) - Rewrite query for better retrieval
3. **Embedding Generation** (Client) - Generate 384-dim vector
4. **Semantic Search** (Server) - Find relevant document chunks
5. **Reranking** (Server) - Sort by relevance (handled in search function)
6. **Building Context** (Server) - Format chunks + conversation memory
7. **Generating Response** (Server) - Stream LLM response

Each step shows:
- Status: active, completed, skipped, error
- Details: e.g., "+3 keywords", "5 docs found"
- Progress indicator

---

## Key Files & Their Roles

| File | Role |
|------|------|
| `components/chat/ChatInterface.tsx` | Main chat UI, orchestrates entire flow |
| `components/chat/ChatPage.tsx` | Wrapper with model selector (mini/standard) |
| `hooks/useStreamingRAG.ts` | Handles SSE streaming from server |
| `hooks/useClientEmbedding.ts` | Generates embeddings client-side with Transformers.js |
| `hooks/useLanguageDetection.ts` | Detects language and dialect of user input |
| `hooks/usePipelineSteps.ts` | Manages pipeline UI state (7 steps) |
| `hooks/useMessageEnhancements.ts` | Handles simplification, summarization, translation |
| `hooks/useGuestMode.ts` | Manages guest mode and conversation migration |
| `hooks/useFileAttachment.ts` | Handles file attachments (future feature) |
| `hooks/useWordExplanation.ts` | Word explanation sidebar state |
| `app/api/chat/query-stream/route.ts` | Main streaming API endpoint (SSE) |
| `app/api/nlp/detect/route.ts` | Language detection API |
| `app/api/nlp/rewrite/route.ts` | Query optimization API |
| `app/api/nlp/simplify/route.ts` | Text simplification API |
| `app/api/nlp/summarize/route.ts` | Text summarization API |
| `app/api/nlp/translate/route.ts` | Translation API |
| `app/api/nlp/explain-word/route.ts` | Word explanation API |
| `lib/embeddings/cache.ts` | Caches embeddings in IndexedDB |
| `lib/embeddings/worker.ts` | Web Worker for embedding generation |
| `lib/nlp/structured-memory.ts` | Builds conversation memory |
| `lib/nlp/confidence-score.ts` | Calculates confidence score |
| `lib/rate-limit.ts` | Rate limiting for guest users |

---

## Unused Code (Removed)

The following code has been removed as part of the streaming-only migration:

### Removed Files
- `app/api/chat/query/route.ts` - Non-streaming API (replaced by query-stream)
- `lib/rag/parallel-pipeline.ts` - Parallel preprocessing (moved to client-side)

### Removed Functions
- `executeRAGQuery()` in `hooks/useRAGQuery.ts` - Non-streaming query execution
- All references to `/api/chat/query` endpoint

### Why Removed?
1. **Streaming is better UX**: Users see response in real-time instead of waiting
2. **Client-side preprocessing**: Language detection, query optimization, and embedding generation happen on client
3. **Simpler architecture**: One API endpoint instead of two
4. **Better performance**: No server-side embedding generation (slow on Vercel)

---

## Current Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT SIDE                              │
├─────────────────────────────────────────────────────────────┤
│ 1. User Input (ChatInterface)                                │
│ 2. Language Detection (API: /api/nlp/detect)                 │
│ 3. Query Optimization (API: /api/nlp/rewrite)                │
│ 4. Embedding Generation (Transformers.js in Web Worker)     │
│ 5. Create/Get Conversation ID                                │
│ 6. Send to Server (SSE stream to /api/chat/query-stream)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     SERVER SIDE                              │
├─────────────────────────────────────────────────────────────┤
│ 1. Authentication & Rate Limiting (guest: 1/hour)            │
│ 2. Save User Message (original query, skip for guests)      │
│ 3. Semantic Search (pgvector, client embedding)             │
│    - Authenticated: personal + public docs                   │
│    - Guest: public docs only                                 │
│ 4. Build Context (structured memory + chunks)               │
│ 5. Stream LLM Response (Vercel AI SDK)                      │
│    - Mini: gemini-2.0-flash-exp                             │
│    - Standard: gemini-2.0-flash-thinking-exp-1219           │
│ 6. Calculate Confidence (source relevance)                   │
│ 7. Save Assistant Message (skip for guests)                  │
│ 8. Send Done Event & Close Stream                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT SIDE                              │
├─────────────────────────────────────────────────────────────┤
│ 1. Receive SSE Events (useStreamingRAG)                      │
│ 2. Update Streaming Message (real-time chunks)               │
│ 3. Display Sources & Confidence                              │
│ 4. Replace with Final Messages                               │
│ 5. Auto-translate if Dialect Detected                        │
│ 6. Mark Guest Query as Used (if guest)                       │
│ 7. Hide Pipeline UI                                           │
└─────────────────────────────────────────────────────────────┘
```

**Key Technologies**:
- **Client Embedding**: Transformers.js (Xenova/bge-small-en-v1.5)
- **Vector Search**: Supabase pgvector (cosine similarity)
- **LLM Streaming**: Vercel AI SDK with Google Gemini
- **Real-time Updates**: Server-Sent Events (SSE)
- **Caching**: IndexedDB for embeddings
- **Rate Limiting**: IP-based for guests

---

## Message Enhancement Features

After receiving the AI response, users can enhance messages:

### 1. Simplify Professional Words
**Hook**: `useMessageEnhancements.simplifyMessage()`
**API**: `/api/nlp/simplify`

- Identifies difficult words
- Provides simpler alternatives
- Shows underlined words with tooltips
- Click word → Show explanation sidebar

### 2. Summarize
**Hook**: `useMessageEnhancements.summarizeMessage()`
**API**: `/api/nlp/summarize`

Two formats:
- **TL;DR**: Short paragraph summary (2-3 sentences)
- **Bullet Points**: Key points + actionable items

### 3. Translate to Dialect
**Hook**: `useMessageEnhancements.translateMessage()`
**API**: `/api/nlp/translate`

- Auto-detects if user speaks a dialect
- Offers to translate AI response
- Supports: Malay dialects, Tamil dialects, etc.

---

## Guest vs Authenticated Flow

### Guest Users
- **Rate Limiting**: 1 query per hour per IP address (strict)
- **Messages**: NOT saved to database (temporary only)
- **Storage**: Messages stored in component state only
- **Conversation ID**: Temporary ID format: `guest-${timestamp}`
- **Knowledge Base**: Can only search public/system documents
- **After Login**: Can migrate conversation to database via `/api/chat/migrate-guest`
- **UI Indicator**: Shows "Sign in to continue" after first query

### Authenticated Users
- **Rate Limiting**: No rate limit at query endpoint (usage tracked separately)
- **Messages**: Saved to database permanently
- **Storage**: Full conversation history in `chat_messages` table
- **Conversation ID**: UUID from database
- **Knowledge Base**: Can search personal + public documents
- **Features**: Can create multiple conversations, upload documents, etc.
- **Usage Tracking**: Tracked in `user_usage` table (monthly limits)

### Guest to Authenticated Migration

When a guest user signs in:

1. Guest conversation stored in localStorage
2. After login, call `/api/chat/migrate-guest` with guest messages
3. Server creates new conversation and saves all messages
4. Client updates conversation ID and clears localStorage
5. User can continue conversation with full features

**Implementation**: `hooks/useGuestMode.ts` handles migration logic

---

## Error Handling

### Client-Side Errors
- Network errors → Show error message
- Embedding generation fails → Retry or show error
- Rate limit exceeded → Show sign-in modal

### Server-Side Errors
- Authentication error → Send error event
- Search error → Continue with no sources
- LLM error → Retry with healing (automatic)
- Database error → Send error event

---

## Performance Optimizations

1. **Client-side embedding**: No server round-trip for embedding generation
2. **Embedding cache**: Reuse embeddings for similar queries
3. **Streaming**: Show response immediately, don't wait for completion
4. **Web Worker**: Embedding generation doesn't block UI
5. **Structured memory**: Only load recent conversation history
6. **Rate limiting**: Prevent abuse from guest users

---

## Future Improvements

1. **Voice input**: Already implemented, can be enhanced
2. **Voice output**: Already implemented, can be enhanced
3. **Multi-modal**: Support images, PDFs, etc.
4. **Better caching**: Cache LLM responses for common queries
5. **Better confidence**: Use more sophisticated scoring
6. **Better context**: Use more advanced RAG techniques

---

## Debugging Tips

### Enable Debug Logging
All functions have console.log statements with prefixes:
- `[ChatInterface]` - Main chat component
- `[RAG Stream]` - Server-side streaming
- `[useStreamingRAG]` - Client-side streaming hook
- `[useClientEmbedding]` - Embedding generation
- `[useMessageEnhancements]` - Message enhancements

### Check Pipeline Steps
Pipeline UI shows current step:
1. Language Detection
2. Query Optimization
3. Embedding Generation
4. Semantic Search
5. Reranking
6. Building Context
7. Generating Response

### Check Network Tab
- Look for `/api/chat/query-stream` request
- Check SSE events in response
- Verify embedding is sent in request body

### Check Database
- `chat_conversations` - Conversation metadata
- `chat_messages` - User and assistant messages
- `query_embeddings_cache` - Cached embeddings
- `document_chunks` - Knowledge base chunks

---

## Summary

The chat flow is a multi-step process that involves:
1. Client-side preprocessing (language detection, query optimization, embedding)
2. Server-side retrieval (semantic search, context building)
3. Streaming LLM response (real-time updates)
4. Post-processing (confidence calculation, message enhancements)

All code is now streaming-only, with no unused non-streaming code remaining.
