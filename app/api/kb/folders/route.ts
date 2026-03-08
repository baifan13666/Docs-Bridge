import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFolders, createFolder } from '@/lib/supabase/queries/kb';

// GET /api/kb/folders - Get all folders
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to continue' },
        { status: 401 }
      );
    }

    const folders = await getFolders(user.id);

    return NextResponse.json({
      success: true,
      folders
    });
  } catch (error: any) {
    console.error('Error fetching folders:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

// POST /api/kb/folders - Create new folder
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
    const { name, icon = 'folder' } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Folder name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Folder name must be less than 100 characters' },
        { status: 400 }
      );
    }

    const folder = await createFolder(user.id, name.trim(), icon);

    return NextResponse.json({
      success: true,
      folder
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating folder:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
