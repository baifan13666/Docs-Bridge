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
    console.log('[useMessageEnhancements] ========== SIMPLIFICATION START ==========');
    console.log('[useMessageEnhancements] Message ID:', messageId);
    console.log('[useMessageEnhancements] Content length:', content.length);
    console.log('[useMessageEnhancements] Content preview:', content.substring(0, 100));
    
    if (enhancements[messageId]?.simplified) {
      console.log('[useMessageEnhancements] ✅ Simplification already exists, switching view');
      console.log('[useMessageEnhancements] Difficult words count:', enhancements[messageId].simplified!.difficult_words.length);
      setMessageView(prev => ({ ...prev, [messageId]: 'simplified' as MessageView }));
      return;
    }

    setLoadingStates(prev => ({ 
      ...prev, 
      [messageId]: { ...prev[messageId], simplifying: true } 
    }));
    
    try {
      console.log('[useMessageEnhancements] 📡 Calling simplifyText API...');
      const result = await nlpApi.simplifyText(content, 'grade_5');
      console.log('[useMessageEnhancements] ✅ API Response received');
      console.log('[useMessageEnhancements] Simplified text length:', result.simplified?.length || 0);
      console.log('[useMessageEnhancements] Difficult words count:', result.difficult_words?.length || 0);
      console.log('[useMessageEnhancements] Difficult words:', result.difficult_words);
      console.log('[useMessageEnhancements] Readability score:', result.readability_score);
      console.log('[useMessageEnhancements] Confidence:', result.confidence);
      
      if (!result.difficult_words || result.difficult_words.length === 0) {
        console.warn('[useMessageEnhancements] ⚠️ WARNING: No difficult words identified!');
        console.warn('[useMessageEnhancements] This means the AI did not find any words to simplify.');
        console.warn('[useMessageEnhancements] The text may already be simple, or the AI needs better prompting.');
      }
      
      setEnhancements(prev => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          simplified: result
        }
      }));
      
      console.log('[useMessageEnhancements] 🔄 Setting message view to "simplified"');
      setMessageView(prev => {
        const newView: {[messageId: string]: MessageView} = { ...prev, [messageId]: 'simplified' as MessageView };
        console.log('[useMessageEnhancements] New messageView state:', newView);
        return newView;
      });
      
      console.log('[useMessageEnhancements] ========== SIMPLIFICATION COMPLETE ==========');
    } catch (error) {
      console.error('[useMessageEnhancements] ❌ Simplification error:', error);
      if (error instanceof Error) {
        console.error('[useMessageEnhancements] Error message:', error.message);
        console.error('[useMessageEnhancements] Error stack:', error.stack);
      }
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
      console.log('[useMessageEnhancements] Calling summarizeText API...');
      const result = await nlpApi.summarizeText(content, format, 5);
      console.log('[useMessageEnhancements] Summarization result:', result);
      console.log('[useMessageEnhancements] Bullet points:', result.bullet_points);
      console.log('[useMessageEnhancements] Key actions:', result.key_actions);
      console.log('[useMessageEnhancements] Word count:', result.word_count);
      
      setEnhancements(prev => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          summary: result
        }
      }));
    } catch (error) {
      console.error('[useMessageEnhancements] Summarization error:', error);
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
      setMessageView(prev => ({ ...prev, [messageId]: 'translated' as MessageView }));
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
      setMessageView(prev => ({ ...prev, [messageId]: 'translated' as MessageView }));
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
    setMessageView(prev => ({ ...prev, [messageId]: view as MessageView }));
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
