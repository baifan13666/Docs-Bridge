/**
 * Crawler Worker API
 * 
 * POST /api/crawler/worker
 * 
 * Background worker that processes crawl jobs from QStash queue
 * This is called by QStash, not directly by users
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { createClient } from '@/lib/supabase/server';
import { getSourceById } from '@/lib/crawler/sources';
import { crawlHTML, isValidCrawlURL } from '@/lib/crawler/html';
import { crawlPDF, isValidPDFURL } from '@/lib/crawler/pdf';
import { normalizeHTMLDocument, normalizePDFDocument, validateDocument, sanitizeContent } from '@/lib/crawler/normalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(request: NextRequest) {
  try {
    console.log('[Crawler Worker] ========================================');
    console.log('[Crawler Worker] Processing crawl job...');

    // Get request body
    const body = await request.json();
    const { source_id, triggered_by, timestamp } = body;

    console.log(`[Crawler Worker] Source ID: ${source_id}`);
    console.log(`[Crawler Worker] Triggered by: ${triggered_by}`);
    console.log(`[Crawler Worker] Timestamp: ${timestamp}`);

    if (!source_id) {
      return NextResponse.json(
        { success: false, error: 'source_id is required' },
        { status: 400 }
      );
    }

    // Get source configuration
    const source = getSourceById(source_id);
    if (!source) {
      return NextResponse.json(
        { success: false, error: 'Source not found' },
        { status: 404 }
      );
    }

    const crawlURL = source.url;

    // Validate URL
    if (source.type === 'pdf' && !isValidPDFURL(crawlURL)) {
      return NextResponse.json(
        { success: false, error: 'Invalid PDF URL' },
        { status: 400 }
      );
    } else if (source.type === 'html' && !isValidCrawlURL(crawlURL)) {
      return NextResponse.json(
        { success: false, error: 'Invalid HTML URL' },
        { status: 400 }
      );
    }

    // Crawl document
    console.log(`[Crawler Worker] Crawling ${source.type.toUpperCase()}: ${crawlURL}`);
    let normalizedDoc;

    try {
      if (source.type === 'pdf') {
        const pdfContent = await crawlPDF(crawlURL);
        normalizedDoc = normalizePDFDocument(pdfContent, source);
      } else {
        const htmlContent = await crawlHTML(crawlURL);
        normalizedDoc = normalizeHTMLDocument(htmlContent, source);
      }
    } catch (crawlError) {
      console.error('[Crawler Worker] Crawl error:', crawlError);
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to crawl document: ${crawlError instanceof Error ? crawlError.message : 'Unknown error'}` 
        },
        { status: 500 }
      );
    }

    // Validate document
    const validation = validateDocument(normalizedDoc);
    if (!validation.valid) {
      console.error('[Crawler Worker] Validation failed:', validation.errors);
      return NextResponse.json(
        { success: false, error: 'Document validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    console.log(`[Crawler Worker] ✅ Crawled: ${normalizedDoc.title}`);
    console.log(`[Crawler Worker] Quality score: ${normalizedDoc.quality_score}/100`);
    console.log(`[Crawler Worker] Word count: ${normalizedDoc.metadata.word_count}`);

    // Sanitize content
    const sanitizedContent = sanitizeContent(normalizedDoc.content);

    // Create Supabase client with service role for background jobs
    const supabase = await createClient();

    // Check if document already exists (by source_url)
    const { data: existingDoc } = await supabase
      .from('kb_documents')
      .select('id')
      .eq('source_url', normalizedDoc.source_url)
      .eq('document_type', 'gov_crawled')
      .single();

    let documentId;

    if (existingDoc) {
      // Update existing document
      console.log(`[Crawler Worker] Updating existing document: ${existingDoc.id}`);
      
      const { data: updatedDoc, error: updateError } = await supabase
        .from('kb_documents')
        .update({
          title: normalizedDoc.title,
          content: sanitizedContent,
          trust_level: normalizedDoc.trust_level,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDoc.id)
        .select()
        .single();

      if (updateError || !updatedDoc) {
        console.error('[Crawler Worker] Update error:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update document' },
          { status: 500 }
        );
      }

      documentId = updatedDoc.id;

      // Delete old chunks for reprocessing
      await supabase
        .from('document_chunks')
        .delete()
        .eq('document_id', documentId);

    } else {
      // Insert new document (use system user for gov documents)
      console.log('[Crawler Worker] Creating new document...');
      
      const { data: document, error: dbError } = await supabase
        .from('kb_documents')
        .insert({
          user_id: process.env.SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000000',
          title: normalizedDoc.title,
          content: sanitizedContent,
          document_type: normalizedDoc.document_type,
          source_url: normalizedDoc.source_url,
          trust_level: normalizedDoc.trust_level,
          icon: source.category === 'healthcare' ? 'medical_services' :
                source.category === 'finance' ? 'account_balance' :
                source.category === 'education' ? 'school' :
                'description'
        })
        .select()
        .single();

      if (dbError || !document) {
        console.error('[Crawler Worker] Database error:', dbError);
        return NextResponse.json(
          { success: false, error: 'Failed to save document' },
          { status: 500 }
        );
      }

      documentId = document.id;
    }

    console.log(`[Crawler Worker] ✅ Saved document: ${documentId}`);

    // Trigger document processing (chunking + embeddings)
    console.log('[Crawler Worker] Triggering document processing...');
    try {
      const processResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/kb/documents/${documentId}/process`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ force_reprocess: true })
        }
      );

      if (!processResponse.ok) {
        console.warn('[Crawler Worker] ⚠️ Processing failed, but document saved');
      } else {
        console.log('[Crawler Worker] ✅ Document processing completed');
      }
    } catch (processError) {
      console.warn('[Crawler Worker] ⚠️ Could not trigger processing:', processError);
    }

    console.log('[Crawler Worker] ✅ Crawl job completed successfully');
    console.log('[Crawler Worker] ========================================');

    return NextResponse.json({
      success: true,
      document_id: documentId,
      source_id: source.id,
      source_name: source.name,
      title: normalizedDoc.title,
      word_count: normalizedDoc.metadata.word_count,
      quality_score: normalizedDoc.quality_score,
      action: existingDoc ? 'updated' : 'created'
    });

  } catch (error) {
    console.error('[Crawler Worker] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// Wrap handler with QStash signature verification
export const POST = verifySignatureAppRouter(handler);
