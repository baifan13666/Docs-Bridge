/**
 * NLP API Client Functions
 * 
 * Client-side functions for calling NLP transformation APIs
 */

// ============================================
// LANGUAGE DETECTION
// ============================================

export interface LanguageDetection {
  language: 'en' | 'ms' | 'id' | 'tl' | 'ta' | 'zh';
  dialect?: string | null;
  confidence: number;
  explanation: string;
}

export async function detectLanguage(text: string): Promise<LanguageDetection> {
  const response = await fetch('/api/nlp/detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to detect language');
  }

  return data;
}

// ============================================
// TEXT SIMPLIFICATION
// ============================================

export interface SimplificationResult {
  original: string;
  simplified: string;
  difficult_words: Array<{
    word: string;
    explanation: string;
    simpler_alternative: string;
    context_snippet?: string;
  }>;
  confidence: number;
  readability_score: {
    original: number;
    simplified: number;
    flesch_reading_ease?: number;
    flesch_kincaid_grade?: number;
    improvement?: number;
  };
}

export async function simplifyText(
  text: string,
  targetLevel: 'grade_5' | 'grade_8' | 'grade_10' = 'grade_5'
): Promise<SimplificationResult> {
  console.log('[nlpApi.simplifyText] Calling API with text length:', text.length);
  
  const response = await fetch('/api/nlp/simplify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target_level: targetLevel })
  });

  const data = await response.json();
  console.log('[nlpApi.simplifyText] API response:', data);

  if (!response.ok) {
    console.error('[nlpApi.simplifyText] API error:', data.error);
    throw new Error(data.error || 'Failed to simplify text');
  }

  // API returns { success: true, result: {...} }
  const result = data.result || data;
  console.log('[nlpApi.simplifyText] Extracted result:', result);
  
  return result;
}

// ============================================
// SUMMARIZATION
// ============================================

export interface SummarizationResult {
  bullet_points: string[];
  key_actions: string[];
  tldr?: string; // Short paragraph summary (only for 'tldr' format)
  word_count: {
    original: number;
    summary: number;
    reduction: number; // percentage
  };
  confidence: number;
}

export async function summarizeText(
  text: string,
  format: 'bullet_points' | 'key_actions' | 'tldr' = 'bullet_points',
  maxPoints: number = 5
): Promise<SummarizationResult> {
  console.log('[nlpApi.summarizeText] Calling API with text length:', text.length);
  
  const response = await fetch('/api/nlp/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, format, max_points: maxPoints })
  });

  const data = await response.json();
  console.log('[nlpApi.summarizeText] API response:', data);

  if (!response.ok) {
    console.error('[nlpApi.summarizeText] API error:', data.error);
    throw new Error(data.error || 'Failed to summarize text');
  }

  // API returns { success: true, result: {...} }
  const result = data.result || data;
  console.log('[nlpApi.summarizeText] Extracted result:', result);
  
  return result;
}

// ============================================
// QUERY REWRITING
// ============================================

export interface QueryRewriteResult {
  original: string;
  rewritten: string;
  added_keywords: string[];
  reasoning: string;
  confidence: number; // 0-1
}

export async function rewriteQuery(
  query: string,
  detectedLanguage: string,
  dialect?: string | null,
  documentLanguage: string = 'en'
): Promise<QueryRewriteResult> {
  const response = await fetch('/api/nlp/rewrite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      detected_language: detectedLanguage,
      dialect,
      document_language: documentLanguage
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to rewrite query');
  }

  return data;
}

// ============================================
// TRANSLATION
// ============================================

export interface TranslationResult {
  translated: string;
  confidence: number;
  alternatives?: Array<{
    text: string;
    confidence: number;
  }>;
  source_language: string;
  target_language: string;
  target_dialect?: string;
}

export async function translateToDialect(
  text: string,
  targetLanguage: string,
  targetDialect?: string,
  preserveSimplification: boolean = true
): Promise<TranslationResult> {
  const response = await fetch('/api/nlp/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      target_language: targetLanguage,
      target_dialect: targetDialect,
      preserve_simplification: preserveSimplification
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to translate text');
  }

  return data.result;
}

// ============================================
// WORD EXPLANATION
// ============================================

export interface WordExplanation {
  word: string;
  explanation: string;
}

export async function explainWord(
  word: string,
  context?: string
): Promise<WordExplanation> {
  console.log('[nlpApi.explainWord] Calling API for word:', word);
  
  const response = await fetch('/api/nlp/explain-word', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, context })
  });

  const data = await response.json();
  console.log('[nlpApi.explainWord] API response:', data);

  if (!response.ok) {
    console.error('[nlpApi.explainWord] API error:', data.error);
    throw new Error(data.error || 'Failed to explain word');
  }

  return {
    word: data.word,
    explanation: data.explanation
  };
}
