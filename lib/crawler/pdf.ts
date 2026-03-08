/**
 * PDF Crawler
 * 
 * Crawls PDF documents and extracts text content
 */

// @ts-ignore - pdf-parse has module resolution issues
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

export interface CrawledPDFContent {
  title: string;
  content: string;
  excerpt: string;
  url: string;
  pageCount: number;
  wordCount: number;
  metadata: {
    author?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
    subject?: string;
    keywords?: string;
  };
}

/**
 * Crawl and extract content from PDF URL
 */
export async function crawlPDF(url: string): Promise<CrawledPDFContent> {
  try {
    console.log(`[PDF Crawler] Fetching: ${url}`);
    
    // Fetch PDF content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DocsBridge/1.0; +https://docsbridge.com/bot)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`[PDF Crawler] Fetched ${buffer.length} bytes`);

    // Parse PDF
    const data = await pdfParse(buffer);
    
    console.log(`[PDF Crawler] Parsed ${data.numpages} pages`);
    console.log(`[PDF Crawler] Extracted ${data.text.length} characters`);

    // Clean the content
    const cleanContent = cleanPDFContent(data.text);
    
    // Extract title from metadata or first line
    const title = data.info?.Title || 
                  extractTitleFromContent(cleanContent) ||
                  'Untitled PDF Document';

    return {
      title,
      content: cleanContent,
      excerpt: cleanContent.substring(0, 200) + '...',
      url,
      pageCount: data.numpages,
      wordCount: cleanContent.split(/\s+/).length,
      metadata: {
        author: data.info?.Author,
        creator: data.info?.Creator,
        producer: data.info?.Producer,
        creationDate: data.info?.CreationDate,
        modificationDate: data.info?.ModDate,
        subject: data.info?.Subject,
        keywords: data.info?.Keywords
      }
    };

  } catch (error) {
    console.error('[PDF Crawler] Error:', error);
    throw new Error(`Failed to crawl PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clean PDF content
 */
function cleanPDFContent(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove page numbers (common patterns)
    .replace(/\bPage \d+\b/gi, '')
    .replace(/\b\d+ of \d+\b/gi, '')
    // Remove headers/footers (lines with only numbers or short text)
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      // Keep lines with substantial content
      return trimmed.length > 10 && !/^\d+$/.test(trimmed);
    })
    .join('\n')
    // Normalize line breaks
    .replace(/\n\s*\n/g, '\n\n')
    // Remove special characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim();
}

/**
 * Extract title from PDF content (first meaningful line)
 */
function extractTitleFromContent(content: string): string | null {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Look for first line that looks like a title
  for (const line of lines.slice(0, 5)) {
    // Title should be reasonably short and not all caps
    if (line.length > 10 && line.length < 200 && line !== line.toUpperCase()) {
      return line;
    }
  }
  
  return null;
}

/**
 * Validate PDF URL
 */
export function isValidPDFURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Check if URL ends with .pdf or has pdf in content-type
    const pathname = parsed.pathname.toLowerCase();
    if (!pathname.endsWith('.pdf')) {
      console.warn('[PDF Crawler] URL does not end with .pdf, may not be a PDF');
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Download PDF to buffer (for local processing)
 */
export async function downloadPDF(url: string): Promise<Buffer> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
