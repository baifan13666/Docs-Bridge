/**
 * Migrate Guest Conversation API
 * 
 * POST /api/chat/migrate-guest
 * 
 * Migrates a guest user's conversation from localStorage to database
 * after they sign up or log in
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get guest conversation data from request
    const body = await request.json();
    const { messages, title } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No messages to migrate' },
        { status: 400 }
      );
    }

    console.log(`[Migrate Guest] Migrating ${messages.length} messages for user ${user.id}`);

    // Create new conversation
    const conversationTitle = title || messages[0]?.content?.substring(0, 50) || 'Migrated Conversation';
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .insert({
        user_id: user.id,
        title: conversationTitle
      })
      .select()
      .single();

    if (convError || !conversation) {
      console.error('[Migrate Guest] Error creating conversation:', convError);
      return NextResponse.json(
        { success: false, error: 'Failed to create conversation' },
        { status: 500 }
      );
    }

    console.log(`[Migrate Guest] Created conversation ${conversation.id}`);

    // Insert all messages
    const messagesToInsert = messages.map((msg: any) => ({
      conversation_id: conversation.id,
      role: msg.role,
      content: msg.content,
      created_at: msg.created_at || new Date().toISOString()
    }));

    const { error: messagesError } = await supabase
      .from('chat_messages')
      .insert(messagesToInsert);

    if (messagesError) {
      console.error('[Migrate Guest] Error inserting messages:', messagesError);
      // Try to clean up the conversation
      await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversation.id);
      
      return NextResponse.json(
        { success: false, error: 'Failed to migrate messages' },
        { status: 500 }
      );
    }

    console.log(`[Migrate Guest] Successfully migrated ${messages.length} messages`);

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title
      }
    });

  } catch (error) {
    console.error('[Migrate Guest] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
