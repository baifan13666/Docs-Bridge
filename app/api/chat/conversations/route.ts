import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getConversations, createConversation } from '@/lib/supabase/queries/chat';

// GET /api/chat/conversations - Get all conversations
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const isArchived = searchParams.get('is_archived') === 'true' ? true : 
                       searchParams.get('is_archived') === 'false' ? false : undefined;

    const { conversations, total } = await getConversations(user.id, limit, offset, isArchived);

    return NextResponse.json({
      success: true,
      conversations,
      total
    });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/chat/conversations - Create new conversation
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
    const { title = 'New Chat' } = body;

    const conversation = await createConversation(user.id, title);

    return NextResponse.json({
      success: true,
      conversation
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
