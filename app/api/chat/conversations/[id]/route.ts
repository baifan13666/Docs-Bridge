import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateConversation, deleteConversation } from '@/lib/supabase/queries/chat';

// PATCH /api/chat/conversations/[id] - Update conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to continue' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, is_archived } = body;

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (is_archived !== undefined) updates.is_archived = is_archived;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'No updates provided' },
        { status: 400 }
      );
    }

    const conversation = await updateConversation(user.id, id, updates);

    return NextResponse.json({
      success: true,
      conversation
    });
  } catch (error: any) {
    console.error('Error updating conversation:', error);
    
    if (error.message === 'Conversation not found') {
      return NextResponse.json(
        { error: 'Not Found', message: error.message },
        { status: 404 }
      );
    }
    
    if (error.message === 'Unauthorized') {
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

// DELETE /api/chat/conversations/[id] - Delete conversation
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to continue' },
        { status: 401 }
      );
    }

    await deleteConversation(user.id, id);

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    
    if (error.message === 'Conversation not found') {
      return NextResponse.json(
        { error: 'Not Found', message: error.message },
        { status: 404 }
      );
    }
    
    if (error.message === 'Unauthorized') {
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
