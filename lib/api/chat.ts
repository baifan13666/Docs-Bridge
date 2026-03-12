// API client functions for Chat

export interface ChatConversation {
  id: string;
  user_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean | null;
  message_count?: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// ============================================
// CONVERSATIONS
// ============================================

export async function fetchConversations(
  limit: number = 50,
  offset: number = 0,
  isArchived?: boolean
): Promise<{ conversations: ChatConversation[]; total: number }> {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());
  if (isArchived !== undefined) {
    params.append('is_archived', isArchived.toString());
  }

  const response = await fetch(`/api/chat/conversations?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch conversations');
  }

  return {
    conversations: data.conversations,
    total: data.total
  };
}

export async function createConversation(title?: string): Promise<ChatConversation> {
  const response = await fetch('/api/chat/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to create conversation');
  }

  return data.conversation;
}

export async function updateConversation(
  id: string,
  updates: { title?: string; is_archived?: boolean }
): Promise<ChatConversation> {
  const response = await fetch(`/api/chat/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to update conversation');
  }

  return data.conversation;
}

export async function deleteConversation(id: string): Promise<void> {
  const response = await fetch(`/api/chat/conversations/${id}`, {
    method: 'DELETE'
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to delete conversation');
  }
}

// ============================================
// MESSAGES
// ============================================

export async function fetchMessages(
  conversationId: string,
  limit: number = 100,
  before?: string
): Promise<ChatMessage[]> {
  const params = new URLSearchParams();
  params.append('conversation_id', conversationId);
  params.append('limit', limit.toString());
  if (before) params.append('before', before);

  const response = await fetch(`/api/chat/messages?${params.toString()}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch messages');
  }

  return data.messages;
}

export async function createMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<ChatMessage> {
  const response = await fetch('/api/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: conversationId,
      role,
      content
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to create message');
  }

  return data.message;
}

// ============================================
// RAG QUERY
// ============================================

export interface RAGQueryResult {
  chunk_id: string;
  document_id: string;
  title: string;
  similarity: number;
  source_url: string | null;
  chunk_text: string;
}

export interface ConfidenceScore {
  overall: number;
  level: 'high' | 'medium' | 'low';
  factors: {
    similarity_scores: number;
    source_quality: number;
    llm_certainty: number;
    coverage: number;
  };
  explanation: string;
}

export interface RAGQueryResponse {
  success: boolean;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  retrieved_chunks: RAGQueryResult[];
  confidence_score: ConfidenceScore;
  metadata: {
    chunks_found: number;
    has_context: boolean;
    language_detected?: string;
    dialect_detected?: string;
    query_rewritten?: boolean;
    keywords_added?: number;
    cache_performance?: {
      original_cache_hit: boolean;
      rewritten_cache_hit: boolean;
      cache_source?: string;
    };
    performance?: {
      total_time: number;
      preprocessing_time: number;
      language_detection: number;
      query_rewrite: number;
      embedding_generation: number;
      structured_memory: number;
    };
  };
}

export async function ragQuery(
  conversationId: string,
  query: string,
  queryEmbedding: number[],
  activeFolders?: string[] | null,
  modelMode?: 'standard' | 'mini',
  originalQuery?: string  // Original user input (for display), if different from optimized query
): Promise<RAGQueryResponse> {
  const response = await fetch('/api/chat/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: conversationId,
      query,
      query_embedding: queryEmbedding,
      active_folders: activeFolders,
      model_mode: modelMode || 'standard',
      original_query: originalQuery,  // Pass original query for user message
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to process RAG query');
  }

  return data;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export async function sendUserMessage(
  conversationId: string,
  content: string
): Promise<ChatMessage> {
  return createMessage(conversationId, 'user', content);
}

export async function getOrCreateConversation(
  conversationId?: string
): Promise<ChatConversation> {
  if (conversationId) {
    // Try to fetch existing conversation
    try {
      const { conversations } = await fetchConversations(1, 0);
      const existing = conversations.find(c => c.id === conversationId);
      if (existing) return existing;
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  }

  // Create new conversation
  return createConversation();
}
