/**
 * Structured Memory Management
 * 
 * Builds JSON-formatted conversation context for RAG pipeline.
 * Includes user profile, conversation summary, and recent messages.
 */

import { createClient } from '@/lib/supabase/server';

export interface StructuredMemory {
  user_profile: {
    id: string;
    language?: string;
    dialect?: string;
    preferences: {
      simplification_level: 'grade_5' | 'grade_8' | 'grade_10';
      preferred_language: string;
    };
  };
  conversation_summary: {
    topic: string;
    key_points: string[];
    entities_mentioned: string[];
  };
  recent_messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    summary?: string;
  }>;
  context_window: {
    total_tokens: number;
    max_tokens: number;
    overflow_strategy: 'sliding_window' | 'summarize_old';
  };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

/**
 * Build structured memory for a conversation
 */
export async function buildStructuredMemory(
  userId: string,
  conversationId: string,
  maxTokens: number = 4000
): Promise<StructuredMemory> {
  const supabase = await createClient();

  // 1. Load user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // 2. Load conversation messages
  const { data: messages } = await supabase
    .from('messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  // 3. Summarize conversation
  const summary = await summarizeConversation(messages || []);

  // 4. Apply sliding window if needed
  const recentMessages = applyContextWindow(messages || [], maxTokens);

  return {
    user_profile: {
      id: userId,
      language: profile?.language || 'en',
      dialect: profile?.dialect || undefined,
      preferences: {
        simplification_level: profile?.simplification_level || 'grade_5',
        preferred_language: profile?.preferred_language || 'en',
      },
    },
    conversation_summary: summary,
    recent_messages: recentMessages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      summary: m.content.length > 200 ? m.content.substring(0, 200) + '...' : undefined,
    })),
    context_window: {
      total_tokens: estimateTokens(recentMessages),
      max_tokens: maxTokens,
      overflow_strategy: 'sliding_window',
    },
  };
}

/**
 * Summarize conversation to extract key information
 */
async function summarizeConversation(messages: Message[]): Promise<{
  topic: string;
  key_points: string[];
  entities_mentioned: string[];
}> {
  if (messages.length === 0) {
    return {
      topic: 'New conversation',
      key_points: [],
      entities_mentioned: [],
    };
  }

  // Extract topic from first user message
  const firstUserMessage = messages.find(m => m.role === 'user');
  const topic = firstUserMessage 
    ? extractTopic(firstUserMessage.content)
    : 'General inquiry';

  // Extract key points from assistant messages
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  const keyPoints = assistantMessages
    .slice(-3) // Last 3 assistant messages
    .map(m => extractKeyPoint(m.content))
    .filter(Boolean);

  // Extract entities (simple keyword extraction)
  const allContent = messages.map(m => m.content).join(' ');
  const entities = extractEntities(allContent);

  return {
    topic,
    key_points: keyPoints,
    entities_mentioned: entities,
  };
}

/**
 * Apply sliding window to keep messages within token limit
 */
function applyContextWindow(messages: Message[], maxTokens: number): Message[] {
  if (messages.length === 0) return [];

  // Always keep the first message (context)
  const firstMessage = messages[0];
  let remainingMessages = messages.slice(1);
  
  // Start from most recent and work backwards
  remainingMessages.reverse();
  
  const selected: Message[] = [];
  let currentTokens = estimateTokens([firstMessage]);

  for (const message of remainingMessages) {
    const messageTokens = estimateTokens([message]);
    if (currentTokens + messageTokens <= maxTokens) {
      selected.unshift(message);
      currentTokens += messageTokens;
    } else {
      break;
    }
  }

  return [firstMessage, ...selected];
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(messages: Message[]): number {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.ceil(totalChars / 4);
}

/**
 * Extract topic from text (first sentence or first 50 chars)
 */
function extractTopic(text: string): string {
  // Get first sentence
  const firstSentence = text.split(/[.!?]/)[0].trim();
  
  // Limit to 50 characters
  if (firstSentence.length > 50) {
    return firstSentence.substring(0, 50) + '...';
  }
  
  return firstSentence;
}

/**
 * Extract key point from assistant message
 */
function extractKeyPoint(text: string): string {
  // Get first sentence
  const firstSentence = text.split(/[.!?]/)[0].trim();
  
  // Limit to 100 characters
  if (firstSentence.length > 100) {
    return firstSentence.substring(0, 100) + '...';
  }
  
  return firstSentence;
}

/**
 * Extract entities (keywords) from text
 */
function extractEntities(text: string): string[] {
  // Common government service keywords
  const keywords = [
    'healthcare', 'kesihatan', 'hospital',
    'cash aid', 'bantuan tunai', 'wang',
    'education', 'pendidikan', 'sekolah',
    'housing', 'perumahan', 'rumah',
    'flood', 'banjir',
    'MySalam', 'SOCSO', 'EPF', 'KWSP',
    'application', 'permohonan',
    'eligibility', 'kelayakan',
    'document', 'dokumen',
  ];

  const lowerText = text.toLowerCase();
  const found = keywords.filter(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );

  // Remove duplicates and limit to 5
  return [...new Set(found)].slice(0, 5);
}

/**
 * Format structured memory for LLM prompt
 */
export function formatStructuredMemoryForPrompt(memory: StructuredMemory): string {
  return `
# User Context
- Language: ${memory.user_profile.language}${memory.user_profile.dialect ? ` (${memory.user_profile.dialect} dialect)` : ''}
- Preferred simplification: ${memory.user_profile.preferences.simplification_level}

# Conversation Summary
- Topic: ${memory.conversation_summary.topic}
- Key points discussed: ${memory.conversation_summary.key_points.join(', ') || 'None yet'}
- Entities mentioned: ${memory.conversation_summary.entities_mentioned.join(', ') || 'None'}

# Recent Messages (${memory.recent_messages.length})
${memory.recent_messages.map(m => `${m.role}: ${m.summary || m.content}`).join('\n')}

# Context Window
- Tokens used: ${memory.context_window.total_tokens} / ${memory.context_window.max_tokens}
- Strategy: ${memory.context_window.overflow_strategy}
`.trim();
}
