/**
 * Crawler Jobs API
 * 
 * GET /api/crawler/jobs
 * 
 * Lists all crawled documents with their status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const documentType = searchParams.get('type') || 'gov_crawled';

    console.log('[Crawler Jobs] Fetching crawled documents...');
    console.log(`[Crawler Jobs] Limit: ${limit}, Offset: ${offset}`);

    // Fetch crawled documents
    const { data: documents, error: fetchError, count } = await supabase
      .from('kb_documents')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('document_type', documentType)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fetchError) {
      console.error('[Crawler Jobs] Fetch error:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    // Check processing status for each document
    const documentsWithStatus = await Promise.all(
      (documents || []).map(async (doc) => {
        // Check if document has been processed (has chunks)
        const { count: chunkCount } = await supabase
          .from('document_chunks')
          .select('*', { count: 'exact', head: true })
          .eq('document_id', doc.id);

        return {
          id: doc.id,
          title: doc.title,
          source_url: doc.source_url,
          trust_level: doc.trust_level,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
          status: chunkCount && chunkCount > 0 ? 'processed' : 'pending',
          chunk_count: chunkCount || 0
        };
      })
    );

    console.log(`[Crawler Jobs] ✅ Found ${documentsWithStatus.length} documents`);

    return NextResponse.json({
      success: true,
      documents: documentsWithStatus,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit
      }
    });

  } catch (error) {
    console.error('[Crawler Jobs] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
