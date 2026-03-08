import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDocuments, createDocument } from '@/lib/supabase/queries/kb';

// GET /api/kb/documents - Get documents
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
    const folderId = searchParams.get('folder_id') || undefined;
    const documentType = searchParams.get('document_type') as 'user' | 'gov_crawled' | undefined;

    const documents = await getDocuments(user.id, folderId, documentType);

    return NextResponse.json({
      success: true,
      documents
    });
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/kb/documents - Create document
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
    const { folder_id, title, icon = 'description', content } = body;

    if (!folder_id || typeof folder_id !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'folder_id is required' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'title is required' },
        { status: 400 }
      );
    }

    const document = await createDocument(
      user.id,
      folder_id,
      title.trim(),
      icon,
      content
    );

    return NextResponse.json({
      success: true,
      document
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating document:', error);
    
    if (error.message === 'Folder not found' || error.message === 'Unauthorized') {
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
