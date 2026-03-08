import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/kb/attachments - Upload attachment
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentId = formData.get('documentId') as string;

    if (!file || !documentId) {
      return NextResponse.json({ error: 'File and documentId are required' }, { status: 400 });
    }

    // Verify document ownership
    const { data: document, error: docError } = await supabase
      .from('kb_documents')
      .select('id')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found or unauthorized' }, { status: 404 });
    }

    // Generate unique file path: userId/documentId/timestamp-filename
    const timestamp = Date.now();
    const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${user.id}/${documentId}/${timestamp}-${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('document-attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Save attachment record to database
    const { data: attachment, error: dbError } = await supabase
      .from('kb_attachments')
      .insert({
        document_id: documentId,
        name: file.name,
        type: file.type,
        size: file.size,
        storage_path: filePath
      })
      .select()
      .single();

    if (dbError) {
      // Rollback: delete uploaded file
      await supabase.storage.from('document-attachments').remove([filePath]);
      console.error('Database error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json(attachment, { status: 201 });
  } catch (error: any) {
    console.error('Error uploading attachment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/kb/attachments?documentId=xxx - Get attachments for a document
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    // Verify document ownership
    const { data: document, error: docError } = await supabase
      .from('kb_documents')
      .select('id')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found or unauthorized' }, { status: 404 });
    }

    // Get attachments
    const { data: attachments, error } = await supabase
      .from('kb_attachments')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching attachments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Generate signed URLs for each attachment
    const attachmentsWithUrls = await Promise.all(
      (attachments || []).map(async (attachment) => {
        const { data: urlData } = await supabase.storage
          .from('document-attachments')
          .createSignedUrl(attachment.storage_path, 3600); // 1 hour expiry

        return {
          ...attachment,
          url: urlData?.signedUrl || null
        };
      })
    );

    return NextResponse.json(attachmentsWithUrls);
  } catch (error: any) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
