import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDocument, updateDocument, deleteDocument } from '@/lib/supabase/queries/kb';

// GET /api/kb/documents/[id] - Get single document
export async function GET(
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

    const document = await getDocument(user.id, id);

    return NextResponse.json({
      success: true,
      document
    });
  } catch (error: any) {
    console.error('Error fetching document:', error);
    
    if (error.message === 'Document not found') {
      return NextResponse.json(
        { error: 'Not Found', message: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// PATCH /api/kb/documents/[id] - Update document
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
    const { title, icon, content } = body;

    const updates: any = {};
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid title' },
          { status: 400 }
        );
      }
      updates.title = title.trim();
    }
    if (icon !== undefined) updates.icon = icon;
    if (content !== undefined) updates.content = content;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'No updates provided' },
        { status: 400 }
      );
    }

    const document = await updateDocument(user.id, id, updates);

    return NextResponse.json({
      success: true,
      document
    });
  } catch (error: any) {
    console.error('Error updating document:', error);
    
    if (error.message === 'Document not found') {
      return NextResponse.json(
        { error: 'Not Found', message: error.message },
        { status: 404 }
      );
    }
    
    if (error.message === 'Unauthorized' || error.message === 'Cannot modify government document') {
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

// DELETE /api/kb/documents/[id] - Delete document
export async function DELETE(
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

    await deleteDocument(user.id, id);

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting document:', error);
    
    if (error.message === 'Document not found') {
      return NextResponse.json(
        { error: 'Not Found', message: error.message },
        { status: 404 }
      );
    }
    
    if (error.message === 'Unauthorized' || error.message === 'Cannot delete government document') {
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
