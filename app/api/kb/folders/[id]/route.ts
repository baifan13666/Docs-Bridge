import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { updateFolder, deleteFolder } from '@/lib/supabase/queries/kb';

// PATCH /api/kb/folders/[id] - Update folder
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
    const { name, icon, is_active } = body;

    const updates: any = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Bad Request', message: 'Invalid folder name' },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }
    if (icon !== undefined) updates.icon = icon;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'No updates provided' },
        { status: 400 }
      );
    }

    const folder = await updateFolder(user.id, id, updates);

    return NextResponse.json({
      success: true,
      folder
    });
  } catch (error: any) {
    console.error('Error updating folder:', error);
    
    if (error.message === 'Folder not found') {
      return NextResponse.json(
        { error: 'Not Found', message: error.message },
        { status: 404 }
      );
    }
    
    if (error.message === 'Unauthorized' || error.message === 'Cannot modify system folder') {
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

// DELETE /api/kb/folders/[id] - Delete folder
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

    await deleteFolder(user.id, id);

    return NextResponse.json({
      success: true,
      message: 'Folder deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting folder:', error);
    
    if (error.message === 'Folder not found') {
      return NextResponse.json(
        { error: 'Not Found', message: error.message },
        { status: 404 }
      );
    }
    
    if (error.message === 'Unauthorized' || error.message === 'Cannot delete system folder') {
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
