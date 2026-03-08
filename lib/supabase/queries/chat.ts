import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type ChatConversation = Database['public']['Tables']['chat_conversations']['Row'];
type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];

// ============================================
// CONVERSATIONS
// ============================================

export async function getConversations(
  userId: string,
  limit: number = 50,
  offset: number = 0,
  isArchived?: boolean
) {
  const supabase = await createClient();
  
  let query = supabase
    .from('chat_conversations')
    .select('*, chat_messages(count)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (isArchived !== undefined) {
    query = query.eq('is_archived', isArchived);
  }

  const { data, error, count } = await query;

  if (error) throw error;
  
  return {
    conversations: data as any[],
    total: count || 0
  };
}

export async function getConversation(userId: string, conversationId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data as ChatConversation;
}

export async function createConversation(userId: string, title: string = 'New Chat') {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({
      user_id: userId,
      title,
      is_archived: false
    })
    .select()
    .single();

  if (error) throw error;
  return data as ChatConversation;
}

export async function updateConversation(
  userId: string,
  conversationId: string,
  updates: { title?: string; is_archived?: boolean }
) {
  const supabase = await createClient();
  
  // Check ownership
  const { data: conversation } = await supabase
    .from('chat_conversations')
    .select('user_id')
    .eq('id', conversationId)
    .single();

  if (!conversation) throw new Error('Conversation not found');
  if (conversation.user_id !== userId) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('chat_conversations')
    .update(updates)
    .eq('id', conversationId)
    .select()
    .single();

  if (error) throw error;
  return data as ChatConversation;
}

export async function deleteConversation(userId: string, conversationId: string) {
  const supabase = await createClient();
  
  // Check ownership
  const { data: conversation } = await supabase
    .from('chat_conversations')
    .select('user_id')
    .eq('id', conversationId)
    .single();

  if (!conversation) throw new Error('Conversation not found');
  if (conversation.user_id !== userId) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('chat_conversations')
    .delete()
    .eq('id', conversationId);

  if (error) throw error;
}

// ============================================
// MESSAGES
// ============================================

export async function getMessages(
  userId: string,
  conversationId: string,
  limit: number = 100,
  beforeMessageId?: string
) {
  const supabase = await createClient();
  
  // Verify conversation ownership
  const { data: conversation } = await supabase
    .from('chat_conversations')
    .select('user_id')
    .eq('id', conversationId)
    .single();

  if (!conversation) throw new Error('Conversation not found');
  if (conversation.user_id !== userId) throw new Error('Unauthorized');

  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (beforeMessageId) {
    // Get messages before a specific message (for pagination)
    const { data: beforeMessage } = await supabase
      .from('chat_messages')
      .select('created_at')
      .eq('id', beforeMessageId)
      .single();

    if (beforeMessage) {
      query = query.lt('created_at', beforeMessage.created_at);
    }
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as ChatMessage[];
}

export async function createMessage(
  userId: string,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
) {
  const supabase = await createClient();
  
  // Verify conversation ownership
  const { data: conversation } = await supabase
    .from('chat_conversations')
    .select('user_id')
    .eq('id', conversationId)
    .single();

  if (!conversation) throw new Error('Conversation not found');
  if (conversation.user_id !== userId) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content
    })
    .select()
    .single();

  if (error) throw error;

  // Update conversation's updated_at timestamp
  await supabase
    .from('chat_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data as ChatMessage;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export async function getOrCreateConversation(userId: string, conversationId?: string) {
  if (conversationId) {
    try {
      return await getConversation(userId, conversationId);
    } catch (error) {
      // If conversation not found, create new one
    }
  }
  
  // Create new conversation
  return await createConversation(userId);
}

export async function updateConversationTitle(
  userId: string,
  conversationId: string,
  firstMessage: string
) {
  // Generate title from first message (first 50 chars)
  const title = firstMessage.length > 50 
    ? firstMessage.substring(0, 50) + '...'
    : firstMessage;
  
  return await updateConversation(userId, conversationId, { title });
}
