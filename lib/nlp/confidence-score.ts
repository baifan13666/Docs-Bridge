/**
 * Confidence Scoring
 * 
 * Calculates confidence scores for RAG responses based on multiple factors
 */

export interface ConfidenceFactors {
  similarity_scores: number; // Average similarity of retrieved chunks (0-1)
  source_quality: number; // Quality of sources (gov docs = 1.0, user docs = 0.7)
  llm_certainty: number; // LLM response certainty based on hedging words (0-1)
  coverage: number; // How well documents cover the query (0-1)
}

export interface ConfidenceScore {
  overall: number; // 0-1
  level: 'high' | 'medium' | 'low';
  factors: ConfidenceFactors;
  explanation: string;
}

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  chunk_text: string;
  similarity: number;
  title: string;
  source_url: string | null;
  document_type: string;
  chunk_index: number;
  trust_level?: number; // From database (1.0 for gov, 0.7 for user)
}

/**
 * Calculate confidence score for RAG response
 * 
 * @param retrievedChunks - Retrieved document chunks with similarity scores
 * @param llmResponse - LLM generated response text
 * @param query - User query text
 * @returns Confidence score with explanation
 * 
 * @example
 * ```typescript
 * const confidence = calculateConfidenceScore(
 *   retrievedChunks,
 *   "You must submit Form A before March 31...",
 *   "How do I apply for financial aid?"
 * );
 * // {
 * //   overall: 0.85,
 * //   level: 'high',
 * //   factors: { ... },
 * //   explanation: "High confidence based on..."
 * // }
 * ```
 */
export function calculateConfidenceScore(
  retrievedChunks: SearchResult[],
  llmResponse: string,
  query: string
): ConfidenceScore {
  if (!retrievedChunks || retrievedChunks.length === 0) {
    return {
      overall: 0.3,
      level: 'low',
      factors: {
        similarity_scores: 0,
        source_quality: 0,
        llm_certainty: 0,
        coverage: 0,
      },
      explanation: 'No relevant documents found to support the answer.',
    };
  }

  // 1. Calculate average similarity scores (30% weight)
  const avgSimilarity = retrievedChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / retrievedChunks.length;

  // 2. Calculate source quality (30% weight)
  // Government documents = 1.0, user documents = 0.7
  const sourceQuality = retrievedChunks.reduce((sum, chunk) => {
    // Use trust_level from database if available, otherwise infer from document_type
    const trustLevel = chunk.trust_level !== undefined 
      ? chunk.trust_level 
      : (chunk.document_type === 'gov_crawled' ? 1.0 : 0.7);
    return sum + trustLevel;
  }, 0) / retrievedChunks.length;

  // 3. Calculate LLM certainty (20% weight)
  // Check for hedging words that indicate uncertainty
  const llmCertainty = analyzeLLMCertainty(llmResponse);

  // 4. Calculate coverage (20% weight)
  // How well the retrieved documents cover the query
  const coverage = calculateCoverage(query, retrievedChunks);

  // 5. Calculate overall score (weighted average)
  const overall = (
    avgSimilarity * 0.30 +
    sourceQuality * 0.30 +
    llmCertainty * 0.20 +
    coverage * 0.20
  );

  // Determine confidence level
  const level: 'high' | 'medium' | 'low' = 
    overall > 0.8 ? 'high' : 
    overall > 0.6 ? 'medium' : 
    'low';

  // Build explanation
  const explanation = buildConfidenceExplanation(overall, {
    avgSimilarity,
    sourceQuality,
    llmCertainty,
    coverage,
  }, retrievedChunks.length);

  return {
    overall,
    level,
    factors: {
      similarity_scores: avgSimilarity,
      source_quality: sourceQuality,
      llm_certainty: llmCertainty,
      coverage,
    },
    explanation,
  };
}

/**
 * Analyze LLM response for certainty indicators
 * 
 * Checks for hedging words that indicate uncertainty:
 * - "might", "maybe", "possibly", "perhaps"
 * - "I think", "I believe", "it seems"
 * - "not sure", "unclear", "uncertain"
 * 
 * Also checks for confidence indicators:
 * - "According to", "Based on", "The document states"
 * - Specific numbers, dates, facts
 */
function analyzeLLMCertainty(response: string): number {
  const lowerResponse = response.toLowerCase();

  // Hedging words (reduce confidence)
  const hedgingWords = [
    'might', 'maybe', 'possibly', 'perhaps', 'probably',
    'i think', 'i believe', 'it seems', 'appears to',
    'not sure', 'unclear', 'uncertain', 'don\'t know',
    'cannot confirm', 'unable to determine',
  ];

  // Confidence indicators (increase confidence)
  const confidenceIndicators = [
    'according to', 'based on', 'the document states',
    'specifically', 'clearly states', 'explicitly',
    'document 1', 'document 2', 'document 3', // Citation indicators
  ];

  // Count hedging words
  let hedgingCount = 0;
  hedgingWords.forEach(word => {
    if (lowerResponse.includes(word)) {
      hedgingCount++;
    }
  });

  // Count confidence indicators
  let confidenceCount = 0;
  confidenceIndicators.forEach(indicator => {
    if (lowerResponse.includes(indicator)) {
      confidenceCount++;
    }
  });

  // Check for "I don't have enough information" or similar
  if (lowerResponse.includes('don\'t have enough information') ||
      lowerResponse.includes('cannot answer') ||
      lowerResponse.includes('insufficient information')) {
    return 0.2; // Very low certainty
  }

  // Calculate certainty score
  // Start at 0.8 (baseline)
  let certainty = 0.8;

  // Reduce for hedging words (max -0.3)
  certainty -= Math.min(hedgingCount * 0.1, 0.3);

  // Increase for confidence indicators (max +0.2)
  certainty += Math.min(confidenceCount * 0.05, 0.2);

  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, certainty));
}

/**
 * Calculate how well the retrieved documents cover the query
 * 
 * Checks:
 * - Are key query terms present in retrieved chunks?
 * - Is there enough content to answer the query?
 * - Are multiple aspects of the query covered?
 */
function calculateCoverage(query: string, chunks: SearchResult[]): number {
  // Extract key terms from query (remove stop words)
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'can', 'could', 'should', 'may', 'might', 'must',
    'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'what', 'when', 'where', 'who', 'why', 'how',
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  ]);

  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(term => term.length > 2 && !stopWords.has(term));

  if (queryTerms.length === 0) {
    return 0.5; // Neutral if no meaningful terms
  }

  // Combine all chunk texts
  const combinedText = chunks
    .map(chunk => chunk.chunk_text.toLowerCase())
    .join(' ');

  // Count how many query terms appear in chunks
  let coveredTerms = 0;
  queryTerms.forEach(term => {
    if (combinedText.includes(term)) {
      coveredTerms++;
    }
  });

  // Calculate coverage ratio
  const coverageRatio = coveredTerms / queryTerms.length;

  // Adjust based on total content length
  const totalLength = combinedText.length;
  const lengthFactor = totalLength > 500 ? 1.0 : totalLength / 500;

  // Final coverage score
  return Math.min(1, coverageRatio * lengthFactor);
}

/**
 * Build human-readable explanation of confidence score
 */
function buildConfidenceExplanation(
  overall: number,
  factors: {
    avgSimilarity: number;
    sourceQuality: number;
    llmCertainty: number;
    coverage: number;
  },
  chunkCount: number
): string {
  const parts: string[] = [];

  // Overall assessment
  if (overall > 0.8) {
    parts.push('High confidence based on');
  } else if (overall > 0.6) {
    parts.push('Medium confidence based on');
  } else {
    parts.push('Low confidence based on');
  }

  // Similarity assessment
  if (factors.avgSimilarity > 0.8) {
    parts.push(`strong document relevance (${(factors.avgSimilarity * 100).toFixed(0)}% similarity)`);
  } else if (factors.avgSimilarity > 0.6) {
    parts.push(`moderate document relevance (${(factors.avgSimilarity * 100).toFixed(0)}% similarity)`);
  } else {
    parts.push(`weak document relevance (${(factors.avgSimilarity * 100).toFixed(0)}% similarity)`);
  }

  // Source quality assessment
  if (factors.sourceQuality > 0.9) {
    parts.push('official government sources');
  } else if (factors.sourceQuality > 0.7) {
    parts.push('mixed government and user sources');
  } else {
    parts.push('primarily user-contributed sources');
  }

  // Coverage assessment
  if (factors.coverage > 0.7) {
    parts.push(`comprehensive coverage of ${chunkCount} documents`);
  } else if (factors.coverage > 0.5) {
    parts.push(`partial coverage from ${chunkCount} documents`);
  } else {
    parts.push(`limited coverage from ${chunkCount} documents`);
  }

  // LLM certainty assessment
  if (factors.llmCertainty < 0.6) {
    parts.push('Note: Response contains uncertainty indicators');
  }

  return parts.join(', ') + '.';
}

/**
 * Get confidence level color for UI
 */
export function getConfidenceLevelColor(level: 'high' | 'medium' | 'low'): string {
  switch (level) {
    case 'high':
      return 'green';
    case 'medium':
      return 'yellow';
    case 'low':
      return 'red';
  }
}

/**
 * Get confidence level emoji for UI
 */
export function getConfidenceLevelEmoji(level: 'high' | 'medium' | 'low'): string {
  switch (level) {
    case 'high':
      return '🟢';
    case 'medium':
      return '🟡';
    case 'low':
      return '🔴';
  }
}
