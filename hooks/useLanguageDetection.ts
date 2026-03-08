import { useState } from 'react';
import * as nlpApi from '@/lib/api/nlp';

export function useLanguageDetection() {
  const [detectedLanguage, setDetectedLanguage] = useState<nlpApi.LanguageDetection | null>(null);
  const [detecting, setDetecting] = useState(false);

  async function detectLanguage(text: string): Promise<nlpApi.LanguageDetection | null> {
    setDetecting(true);
    try {
      const result = await nlpApi.detectLanguage(text);
      setDetectedLanguage(result);
      return result;
    } catch (error) {
      console.error('Language detection failed:', error);
      return null;
    } finally {
      setDetecting(false);
    }
  }

  function getLanguageName(code: string): string {
    const names: Record<string, string> = {
      en: 'English',
      ms: 'Malay',
      id: 'Indonesian',
      tl: 'Tagalog',
      ta: 'Tamil',
      zh: 'Chinese',
    };
    return names[code] || code;
  }

  function reset() {
    setDetectedLanguage(null);
    setDetecting(false);
  }

  return {
    detectedLanguage,
    detecting,
    detectLanguage,
    getLanguageName,
    reset
  };
}
