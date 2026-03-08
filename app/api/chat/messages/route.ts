import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMessages, createMessage } from '@/lib/supabase/queries/chat';

// GET /api/chat/messages - Get messages for a conversation
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to continue' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversation_id');
    const limit = parseInt(searchParams.get('limit') || '100');
    const before = searchParams.get('before') || undefined;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'conversation_id is required' },
        { status: 400 }
      );
    }

    const messages = await getMessages(user.id, conversationId, limit, before);

    return NextResponse.json({
      success: true,
      messages
    });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    
    if (error.message === 'Conversation not found' || error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Forbidden', message: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/chat/messages - Create a message
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to continue' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { conversation_id, role, content } = body;

    if (!conversation_id || !role || !content) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'conversation_id, role, and content are required' },
        { status: 400 }
      );
    }

    if (role !== 'user' && role !== 'assistant') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'role must be "user" or "assistant"' },
        { status: 400 }
      );
    }

    const message = await createMessage(user.id, conversation_id, role, content);

    return NextResponse.json({
      success: true,
      message
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating message:', error);
    
    if (error.message === 'Conversation not found' || error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Forbidden', message: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
