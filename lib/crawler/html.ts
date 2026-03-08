/**
 * HTML Crawler
 * 
 * Crawls HTML pages and extracts clean, readable content
 */

import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface CrawledHTMLContent {
  title: string;
  content: string;
  excerpt: string;
  author?: string;
  publishedDate?: string;
  url: string;
  siteName?: string;
  language?: string;
  wordCount: number;
  metadata: {
    description?: string;
    keywords?: string[];
    ogImage?: string;
  };
}

/**
 * Crawl and extract content from HTML URL
 */
export async function crawlHTML(url: string): Promise<CrawledHTMLContent> {
  try {
    console.log(`[HTML Crawler] Fetching: ${url}`);
    
    // Fetch HTML content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DocsBridge/1.0; +https://docsbridge.com/bot)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    console.log(`[HTML Crawler] Fetched ${html.length} characters`);

    // Parse with Cheerio for metadata extraction
    const $ = cheerio.load(html);
    
    // Extract metadata
    const metadata = {
      description: $('meta[name="description"]').attr('content') || 
                   $('meta[property="og:description"]').attr('content'),
      keywords: $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()),
      ogImage: $('meta[property="og:image"]').attr('content')
    };

    // Use Readability for main content extraction
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      throw new Error('Failed to parse article content');
    }

    // Clean the content
    const cleanContent = cleanHTMLContent(article.textContent || '');
    
    console.log(`[HTML Crawler] Extracted: ${article.title}`);
    console.log(`[HTML Crawler] Content length: ${cleanContent.length} characters`);

    return {
      title: article.title || extractTitleFromHTML($),
      content: cleanContent,
      excerpt: article.excerpt || cleanContent.substring(0, 200) + '...',
      author: article.byline || undefined,
      publishedDate: extractPublishedDate($),
      url,
      siteName: article.siteName || extractSiteName($),
      language: extractLanguage($),
      wordCount: cleanContent.split(/\s+/).length,
      metadata
    };

  } catch (error) {
    console.error('[HTML Crawler] Error:', error);
    throw new Error(`Failed to crawl HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clean HTML content
 */
function cleanHTMLContent(text: string): string {
  return text
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove leading/trailing whitespace
    .trim()
    // Normalize line breaks
    .replace(/\n\s*\n/g, '\n\n')
    // Remove special characters that might cause issues
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

/**
 * Extract title from HTML if Readability fails
 */
function extractTitleFromHTML($: cheerio.CheerioAPI): string {
  return $('title').text() ||
         $('meta[property="og:title"]').attr('content') ||
         $('h1').first().text() ||
         'Untitled Document';
}

/**
 * Extract published date from HTML
 */
function extractPublishedDate($: cheerio.CheerioAPI): string | undefined {
  const dateSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="publish-date"]',
    'meta[name="date"]',
    'time[datetime]'
  ];

  for (const selector of dateSelectors) {
    const date = $(selector).attr('content') || $(selector).attr('datetime');
    if (date) return date;
  }

  return undefined;
}

/**
 * Extract site name from HTML
 */
function extractSiteName($: cheerio.CheerioAPI): string | undefined {
  return $('meta[property="og:site_name"]').attr('content') ||
         $('meta[name="application-name"]').attr('content');
}

/**
 * Extract language from HTML
 */
function extractLanguage($: cheerio.CheerioAPI): string | undefined {
  return $('html').attr('lang') ||
         $('meta[http-equiv="content-language"]').attr('content');
}

/**
 * Validate URL before crawling
 */
export function isValidCrawlURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Block localhost and private IPs
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || 
        hostname.startsWith('127.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
