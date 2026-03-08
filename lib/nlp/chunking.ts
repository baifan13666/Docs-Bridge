/**
 * Document Chunking Module
 * 
 * Uses LangChain's RecursiveCharacterTextSplitter for intelligent text chunking.
 * Optimized for RAG (Retrieval-Augmented Generation) pipelines.
 * 
 * Strategy:
 * - Chunk size: 500-800 tokens (optimal for semantic search)
 * - Overlap: 100 tokens (maintains context between chunks)
 * - Recursive splitting: Tries to split on natural boundaries
 * 
 * @module lib/nlp/chunking
 */

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

/**
 * Default chunking configuration
 */
const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 100;

/**
 * Approximate tokens per character (for English text)
 * GPT models: ~4 characters per token
 * Multilingual: ~3-5 characters per token
 */
const CHARS_PER_TOKEN = 4;

/**
 * Chunk a document into smaller pieces for embedding
 * 
 * @param content - The document content to chunk
 * @param options - Optional chunking configuration
 * @returns Array of text chunks with metadata
 * 
 * @example
 * ```typescript
 * const chunks = await chunkDocument(documentContent);
 * // Returns: [
 * //   { text: "...", index: 0, tokenCount: 750 },
 * //   { text: "...", index: 1, tokenCount: 800 },
 * //   ...
 * // ]
 * ```
 */
export async function chunkDocument(
  content: string,
  options?: {
    chunkSize?: number;
    chunkOverlap?: number;
    separators?: string[];
  }
): Promise<Array<{
  text: string;
  index: number;
  tokenCount: number;
}>> {
  if (!content || content.trim().length === 0) {
    throw new Error('Document content cannot be empty');
  }

  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    chunkOverlap = DEFAULT_CHUNK_OVERLAP,
    separators
  } = options || {};

  // Create text splitter
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: chunkSize * CHARS_PER_TOKEN, // Convert tokens to characters
    chunkOverlap: chunkOverlap * CHARS_PER_TOKEN,
    separators: separators || [
      '\n\n',  // Paragraph breaks
      '\n',    // Line breaks
      '. ',    // Sentences
      '! ',
      '? ',
      '; ',
      ', ',    // Clauses
      ' ',     // Words
      ''       // Characters (fallback)
    ],
  });

  console.log('[Chunking] Splitting document...');
  console.log(`[Chunking] Content length: ${content.length} characters`);
  console.log(`[Chunking] Target chunk size: ${chunkSize} tokens (~${chunkSize * CHARS_PER_TOKEN} chars)`);
  
  const startTime = Date.now();
  
  // Split the text
  const chunks = await splitter.splitText(content);
  
  const chunkTime = ((Date.now() - startTime) / 1000).toFixed(3);
  console.log(`[Chunking] Created ${chunks.length} chunks in ${chunkTime}s`);

  // Add metadata to each chunk
  return chunks.map((text: string, index: number) => ({
    text,
    index,
    tokenCount: Math.ceil(text.length / CHARS_PER_TOKEN)
  }));
}

/**
 * Chunk multiple documents in batch
 * 
 * @param documents - Array of documents to chunk
 * @returns Array of chunked documents with metadata
 */
export async function chunkDocuments(
  documents: Array<{
    id: string;
    content: string;
  }>,
  options?: {
    chunkSize?: number;
    chunkOverlap?: number;
  }
): Promise<Array<{
  documentId: string;
  chunks: Array<{
    text: string;
    index: number;
    tokenCount: number;
  }>;
}>> {
  console.log(`[Chunking] Processing ${documents.length} documents...`);
  
  const results = await Promise.all(
    documents.map(async (doc) => {
      try {
        const chunks = await chunkDocument(doc.content, options);
        return {
          documentId: doc.id,
          chunks
        };
      } catch (error) {
        console.error(`[Chunking] Error processing document ${doc.id}:`, error);
        return {
          documentId: doc.id,
          chunks: []
        };
      }
    })
  );

  const totalChunks = results.reduce((sum, r) => sum + r.chunks.length, 0);
  console.log(`[Chunking] Total chunks created: ${totalChunks}`);

  return results;
}

/**
 * Estimate token count for a text
 * 
 * @param text - Text to estimate
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Validate chunk size is within acceptable range
 * 
 * @param chunkSize - Chunk size in tokens
 * @returns true if valid, throws error if invalid
 */
export function validateChunkSize(chunkSize: number): boolean {
  const MIN_CHUNK_SIZE = 100;
  const MAX_CHUNK_SIZE = 2000;

  if (chunkSize < MIN_CHUNK_SIZE) {
    throw new Error(`Chunk size too small: ${chunkSize} (minimum: ${MIN_CHUNK_SIZE})`);
  }

  if (chunkSize > MAX_CHUNK_SIZE) {
    throw new Error(`Chunk size too large: ${chunkSize} (maximum: ${MAX_CHUNK_SIZE})`);
  }

  return true;
}
