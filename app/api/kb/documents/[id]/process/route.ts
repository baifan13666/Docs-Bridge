/**
 * Document Processing API
 * 
 * POST /api/kb/documents/[id]/process
 * 
 * Processes a document for RAG:
 * 1. Chunks the document content
 * 2. Generates embeddings using intfloat/e5-small (384-dim)
 * 3. Saves chunks to database
 * 
 * This endpoint is called:
 * - When a user manually triggers processing
 * - By the crawler after fetching government documents
 * - When a document is updated
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { chunkDocument } from '@/lib/nlp/chunking';
import { generateQueryEmbedding } from '@/lib/embeddings/query';

// Route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const supabase = await createClient();

    // Get request body first to check if this is a system call
    const body = await request.json().catch(() => ({}));
    const { force_reprocess = false, system_call = false } = body;

    // Check authentication (skip for system calls from crawler)
    let user = null;
    if (!system_call) {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
      user = authUser;
    }

    console.log(`[Process Document] Starting processing for document ${documentId}`);
    console.log(`[Process Document] Force reprocess: ${force_reprocess}`);

    // Get document
    const { data: document, error: docError } = await supabase
      .from('kb_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      );
    }

    // Check authorization (user owns document OR it's a government document OR system call)
    if (!system_call && user && document.user_id !== user.id && document.document_type !== 'gov_crawled') {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Check if document has content
    if (!document.content || document.content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Document has no content to process' },
        { status: 400 }
      );
    }

    // Check if already processed (unless force_reprocess)
    if (!force_reprocess) {
      const { count } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId);

      if (count && count > 0) {
        console.log(`[Process Document] Document already has ${count} chunks`);
        return NextResponse.json({
          success: true,
          message: 'Document already processed',
          chunks_created: count,
          skipped: true
        });
      }
    } else {
      // Delete existing chunks if force reprocessing
      console.log('[Process Document] Deleting existing chunks...');
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId);
    }

    // Step 1: Chunk the document
    console.log('[Process Document] Step 1: Chunking document...');
    const chunks = await chunkDocument(document.content, {
      chunkSize: 800,
      chunkOverlap: 100
    });

    console.log(`[Process Document] Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No chunks created (document too short)',
        chunks_created: 0
      });
    }

    // Step 2: Generate embeddings for all chunks
    console.log('[Process Document] Step 2: Generating embeddings...');
    console.log('[Process Document] Using intfloat/e5-small (384-dim) for consistency');
    
    const chunkTexts = chunks.map(c => c.text);
    const embeddings: number[][] = [];
    
    // Generate embeddings one by one (to avoid memory issues)
    for (let i = 0; i < chunkTexts.length; i++) {
      try {
        const embedding = await generateQueryEmbedding(chunkTexts[i]);
        embeddings.push(embedding);
        
        if ((i + 1) % 10 === 0) {
          console.log(`[Process Document] Generated ${i + 1}/${chunkTexts.length} embeddings`);
        }
      } catch (error) {
        console.error(`[Process Document] Failed to generate embedding for chunk ${i}:`, error);
        throw error;
      }
    }

    console.log(`[Process Document] Generated ${embeddings.length} embeddings`);

    // Step 3: Save chunks to database with embeddings
    console.log('[Process Document] Step 3: Saving chunks with embeddings...');
    const chunksToInsert = chunks.map((chunk, index) => ({
      document_id: documentId,
      chunk_text: chunk.text,
      chunk_index: chunk.index,
      embedding: embeddings[index],  // 384-dim intfloat/e5-small
      token_count: chunk.tokenCount,
      language: document.language || null
    }));

    const { error: insertError } = await supabase
      .from('document_chunks')
      .insert(chunksToInsert);

    if (insertError) {
      console.error('[Process Document] Error inserting chunks:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to save chunks' },
        { status: 500 }
      );
    }

    console.log(`[Process Document] Successfully processed document ${documentId}`);

    return NextResponse.json({
      success: true,
      chunks_created: chunks.length,
      language_detected: document.language || 'unknown',
      message: `Document processed: ${chunks.length} chunks created`
    });

  } catch (error) {
    console.error('[Process Document] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
