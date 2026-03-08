/**
 * Crawler API
 * 
 * POST /api/crawler/crawl
 * 
 * Crawls a government document and saves it to the knowledge base
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSourceById } from '@/lib/crawler/sources';
import { crawlHTML, isValidCrawlURL } from '@/lib/crawler/html';
import { crawlPDF, isValidPDFURL } from '@/lib/crawler/pdf';
import { normalizeHTMLDocument, normalizePDFDocument, validateDocument, sanitizeContent } from '@/lib/crawler/normalize';

export async function POST(request: NextRequest) {
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

    // Get request body
    const body = await request.json();
    const { source_id, url, folder_id } = body;

    if (!source_id && !url) {
      return NextResponse.json(
        { success: false, error: 'Either source_id or url is required' },
        { status: 400 }
      );
    }

    console.log('[Crawler] ========================================');
    console.log('[Crawler] Starting crawl job...');
    console.log(`[Crawler] Source ID: ${source_id || 'custom'}`);
    console.log(`[Crawler] URL: ${url || 'from source'}`);

    // Get source configuration
    let source;
    let crawlURL;

    if (source_id) {
      source = getSourceById(source_id);
      if (!source) {
        return NextResponse.json(
          { success: false, error: 'Source not found' },
          { status: 404 }
        );
      }
      crawlURL = source.url;
    } else {
      // Custom URL crawl
      crawlURL = url;
      source = {
        id: 'custom',
        name: 'Custom Source',
        country: 'malaysia' as const,
        url: url,
        type: url.toLowerCase().endsWith('.pdf') ? 'pdf' as const : 'html' as const,
        trust_level: 3,
        category: 'general' as const,
        language: 'en',
        description: 'Custom crawled document'
      };
    }

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
    console.log(`[Crawler] Crawling ${source.type.toUpperCase()}: ${crawlURL}`);
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
      console.error('[Crawler] Crawl error:', crawlError);
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
      console.error('[Crawler] Validation failed:', validation.errors);
      return NextResponse.json(
        { success: false, error: 'Document validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    console.log(`[Crawler] ✅ Crawled: ${normalizedDoc.title}`);
    console.log(`[Crawler] Quality score: ${normalizedDoc.quality_score}/100`);
    console.log(`[Crawler] Word count: ${normalizedDoc.metadata.word_count}`);

    // Sanitize content
    const sanitizedContent = sanitizeContent(normalizedDoc.content);

    // Save to database
    console.log('[Crawler] Saving to database...');
    const { data: document, error: dbError } = await supabase
      .from('kb_documents')
      .insert({
        user_id: user.id,
        folder_id: folder_id || null,
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
      console.error('[Crawler] Database error:', dbError);
      return NextResponse.json(
        { success: false, error: 'Failed to save document' },
        { status: 500 }
      );
    }

    console.log(`[Crawler] ✅ Saved document: ${document.id}`);

    // Trigger document processing (chunking + embeddings)
    console.log('[Crawler] Triggering document processing...');
    try {
      const processResponse = await fetch(
        `${request.nextUrl.origin}/api/kb/documents/${document.id}/process`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || ''
          }
        }
      );

      if (!processResponse.ok) {
        console.warn('[Crawler] ⚠️ Processing failed, but document saved');
      } else {
        console.log('[Crawler] ✅ Document processing started');
      }
    } catch (processError) {
      console.warn('[Crawler] ⚠️ Could not trigger processing:', processError);
    }

    console.log('[Crawler] ✅ Crawl job completed successfully');
    console.log('[Crawler] ========================================');

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        word_count: normalizedDoc.metadata.word_count,
        quality_score: normalizedDoc.quality_score,
        trust_level: document.trust_level,
        source_url: document.source_url
      },
      metadata: normalizedDoc.metadata
    });

  } catch (error) {
    console.error('[Crawler] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
