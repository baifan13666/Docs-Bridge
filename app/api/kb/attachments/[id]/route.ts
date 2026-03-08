import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// DELETE /api/kb/attachments/[id] - Delete attachment
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get attachment with document ownership check
    const { data: attachment, error: fetchError } = await supabase
      .from('kb_attachments')
      .select(`
        *,
        kb_documents!inner(user_id)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Check ownership
    if (attachment.kb_documents.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('document-attachments')
      .remove([attachment.storage_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('kb_attachments')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error('Database deletion error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
