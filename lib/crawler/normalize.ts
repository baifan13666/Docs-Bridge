/**
 * Document Normalizer
 * 
 * Normalizes crawled documents into a unified format
 */

import type { CrawledHTMLContent } from './html';
import type { CrawledPDFContent } from './pdf';
import type { GovernmentSource } from './sources';

export interface NormalizedDocument {
  title: string;
  content: string;
  excerpt: string;
  source_url: string;
  document_type: 'gov_crawled';
  trust_level: number;
  metadata: {
    source_id: string;
    source_name: string;
    country: string;
    category: string;
    language: string;
    crawled_at: string;
    word_count: number;
    page_count?: number;
    author?: string;
    published_date?: string;
    original_metadata?: any;
  };
  quality_score: number;
}

/**
 * Normalize HTML content
 */
export function normalizeHTMLDocument(
  content: CrawledHTMLContent,
  source: GovernmentSource
): NormalizedDocument {
  const qualityScore = calculateQualityScore({
    wordCount: content.wordCount,
    hasTitle: !!content.title,
    hasExcerpt: !!content.excerpt,
    hasMetadata: !!(content.metadata.description || content.metadata.keywords),
    hasAuthor: !!content.author,
    hasPublishedDate: !!content.publishedDate
  });

  return {
    title: content.title,
    content: content.content,
    excerpt: content.excerpt,
    source_url: content.url,
    document_type: 'gov_crawled',
    trust_level: source.trust_level,
    metadata: {
      source_id: source.id,
      source_name: source.name,
      country: source.country,
      category: source.category,
      language: content.language || source.language,
      crawled_at: new Date().toISOString(),
      word_count: content.wordCount,
      author: content.author,
      published_date: content.publishedDate,
      original_metadata: content.metadata
    },
    quality_score: qualityScore
  };
}

/**
 * Normalize PDF content
 */
export function normalizePDFDocument(
  content: CrawledPDFContent,
  source: GovernmentSource
): NormalizedDocument {
  const qualityScore = calculateQualityScore({
    wordCount: content.wordCount,
    hasTitle: !!content.title,
    hasExcerpt: !!content.excerpt,
    hasMetadata: !!(content.metadata.author || content.metadata.subject),
    hasAuthor: !!content.metadata.author,
    hasPublishedDate: !!content.metadata.creationDate
  });

  return {
    title: content.title,
    content: content.content,
    excerpt: content.excerpt,
    source_url: content.url,
    document_type: 'gov_crawled',
    trust_level: source.trust_level,
    metadata: {
      source_id: source.id,
      source_name: source.name,
      country: source.country,
      category: source.category,
      language: source.language,
      crawled_at: new Date().toISOString(),
      word_count: content.wordCount,
      page_count: content.pageCount,
      author: content.metadata.author,
      published_date: content.metadata.creationDate,
      original_metadata: content.metadata
    },
    quality_score: qualityScore
  };
}

/**
 * Calculate document quality score (0-100)
 */
function calculateQualityScore(factors: {
  wordCount: number;
  hasTitle: boolean;
  hasExcerpt: boolean;
  hasMetadata: boolean;
  hasAuthor: boolean;
  hasPublishedDate: boolean;
}): number {
  let score = 0;

  // Word count (0-40 points)
  if (factors.wordCount >= 1000) score += 40;
  else if (factors.wordCount >= 500) score += 30;
  else if (factors.wordCount >= 200) score += 20;
  else if (factors.wordCount >= 100) score += 10;

  // Required fields (0-30 points)
  if (factors.hasTitle) score += 15;
  if (factors.hasExcerpt) score += 15;

  // Optional metadata (0-30 points)
  if (factors.hasMetadata) score += 10;
  if (factors.hasAuthor) score += 10;
  if (factors.hasPublishedDate) score += 10;

  return Math.min(100, score);
}

/**
 * Validate normalized document
 */
export function validateDocument(doc: NormalizedDocument): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields
  if (!doc.title || doc.title.trim().length === 0) {
    errors.push('Title is required');
  }

  if (!doc.content || doc.content.trim().length < 100) {
    errors.push('Content must be at least 100 characters');
  }

  if (!doc.source_url) {
    errors.push('Source URL is required');
  }

  if (doc.trust_level < 1 || doc.trust_level > 5) {
    errors.push('Trust level must be between 1 and 5');
  }

  if (doc.quality_score < 20) {
    errors.push('Quality score too low (minimum 20)');
  }

  // Metadata validation
  if (!doc.metadata.source_id) {
    errors.push('Source ID is required in metadata');
  }

  if (!doc.metadata.country) {
    errors.push('Country is required in metadata');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize content for storage
 */
export function sanitizeContent(content: string): string {
  return content
    // Remove null bytes
    .replace(/\0/g, '')
    // Normalize unicode
    .normalize('NFC')
    // Limit length (max 1MB)
    .substring(0, 1000000);
}
