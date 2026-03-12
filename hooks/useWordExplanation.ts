import { useState } from 'react';
import * as nlpApi from '@/lib/api/nlp';

export function useWordExplanation() {
  const [showWordSidebar, setShowWordSidebar] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordContext, setWordContext] = useState<string>('');
  const [wordExplanation, setWordExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  const handleWordClick = async (word: string, context: string) => {
    console.log('[useWordExplanation] Word clicked:', word);
    setSelectedWord(word);
    setWordContext(context);
    setShowWordSidebar(true);
    setWordExplanation(null);
    setLoadingExplanation(true);
    
    try {
      const result = await nlpApi.explainWord(word, context);
      setWordExplanation(result.explanation);
    } catch (error) {
      console.error('[useWordExplanation] Failed to explain word:', error);
      setWordExplanation('Failed to load explanation. Please try again.');
    } finally {
      setLoadingExplanation(false);
    }
  };

  const closeSidebar = () => {
    setShowWordSidebar(false);
  };

  return {
    showWordSidebar,
    selectedWord,
    wordContext,
    wordExplanation,
    loadingExplanation,
    handleWordClick,
    closeSidebar
  };
}
