import { useState } from 'react';
import * as nlpApi from '@/lib/api/nlp';

interface MessageEnhancements {
  simplified?: nlpApi.SimplificationResult;
  summary?: nlpApi.SummarizationResult;
  translations?: {
    [key: string]: nlpApi.TranslationResult;
  };
}

type MessageView = 'original' | 'simplified' | 'translated';

export function useMessageEnhancements() {
  const [enhancements, setEnhancements] = useState<{[messageId: string]: MessageEnhancements}>({});
  const [messageView, setMessageView] = useState<{[messageId: string]: MessageView}>({});
  const [loadingStates, setLoadingStates] = useState<{
    [messageId: string]: {
      simplifying?: boolean;
      summarizing?: boolean;
      summarizingTldr?: boolean;
      summarizingBullets?: boolean;
      translating?: boolean;
    }
  }>({});

  async function simplifyMessage(messageId: string, content: string) {
    if (enhancements[messageId]?.simplified) {
      setMessageView(prev => ({ ...prev, [messageId]: 'simplified' }));
      return;
    }

    setLoadingStates(prev => ({ 
      ...prev, 
      [messageId]: { ...prev[messageId], simplifying: true } 
    }));
    
    try {
      const result = await nlpApi.simplifyText(content, 'grade_5');
      setEnhancements(prev => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          simplified: result
        }
      }));
      setMessageView(prev => ({ ...prev, [messageId]: 'simplified' }));
    } catch (error) {
      console.error('Simplification error:', error);
    } finally {
      setLoadingStates(prev => ({ 
        ...prev, 
        [messageId]: { ...prev[messageId], simplifying: false } 
      }));
    }
  }

  async function summarizeMessage(messageId: string, content: string, format: 'bullet_points' | 'key_actions' | 'tldr' = 'bullet_points') {
    if (enhancements[messageId]?.summary) {
      return;
    }

    // Set specific loading state based on format
    const loadingKey = format === 'tldr' ? 'summarizingTldr' : 'summarizingBullets';
    setLoadingStates(prev => ({ 
      ...prev, 
      [messageId]: { ...prev[messageId], [loadingKey]: true, summarizing: true } 
    }));
    
    try {
      const result = await nlpApi.summarizeText(content, format, 5);
      setEnhancements(prev => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          summary: result
        }
      }));
    } catch (error) {
      console.error('Summarization error:', error);
    } finally {
      setLoadingStates(prev => ({ 
        ...prev, 
        [messageId]: { ...prev[messageId], [loadingKey]: false, summarizing: false } 
      }));
    }
  }

  async function translateMessage(
    messageId: string,
    content: string,
    targetLanguage: string,
    targetDialect?: string
  ) {
    const translationKey = `${targetLanguage}${targetDialect ? `-${targetDialect}` : ''}`;
    
    if (enhancements[messageId]?.translations?.[translationKey]) {
      setMessageView(prev => ({ ...prev, [messageId]: 'translated' }));
      return;
    }

    setLoadingStates(prev => ({ 
      ...prev, 
      [messageId]: { ...prev[messageId], translating: true } 
    }));
    
    try {
      const result = await nlpApi.translateToDialect(
        content,
        targetLanguage,
        targetDialect,
        true
      );
      
      setEnhancements(prev => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          translations: {
            ...prev[messageId]?.translations,
            [translationKey]: result
          }
        }
      }));
      setMessageView(prev => ({ ...prev, [messageId]: 'translated' }));
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setLoadingStates(prev => ({ 
        ...prev, 
        [messageId]: { ...prev[messageId], translating: false } 
      }));
    }
  }

  function getMessageContent(messageId: string, originalContent: string): string {
    const view = messageView[messageId] || 'original';
    const enhancement = enhancements[messageId];
    
    if (view === 'simplified' && enhancement?.simplified) {
      return enhancement.simplified.simplified;
    }
    
    if (view === 'translated' && enhancement?.translations) {
      const translationKey = Object.keys(enhancement.translations)[0];
      return enhancement.translations[translationKey]?.translated || originalContent;
    }
    
    return originalContent;
  }

  function setView(messageId: string, view: MessageView) {
    setMessageView(prev => ({ ...prev, [messageId]: view }));
  }

  return {
    enhancements,
    messageView,
    loadingStates,
    simplifyMessage,
    summarizeMessage,
    translateMessage,
    getMessageContent,
    setView
  };
}
