'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SignInModal from '../auth/SignInModal';
import DifficultWordsText from './DifficultWordsText';
import VoiceInput from './VoiceInput';
import { useTranslations } from 'next-intl';
import * as nlpApi from '@/lib/api/nlp';
import { useChatMessages } from '@/hooks/useChatMessages';
import { usePipelineSteps } from '@/hooks/usePipelineSteps';
import { useMessageEnhancements } from '@/hooks/useMessageEnhancements';
import { useLanguageDetection } from '@/hooks/useLanguageDetection';
import { useRAGQuery } from '@/hooks/useRAGQuery';
import { useVoiceOutput } from '@/hooks/useVoiceOutput';
import { useStreamingRAG } from '@/hooks/useStreamingRAG';
import { useStreamingSettings } from '@/hooks/useStreamingSettings';
import { useEmbedding } from '@/hooks/useEmbedding';

interface ChatInterfaceProps {
  isAuthenticated: boolean;
  userEmail?: string;
  conversationId?: string;
  modelMode?: 'standard' | 'mini';
  onModelModeChange?: (mode: 'standard' | 'mini') => void;
}

export default function ChatInterface({ 
  isAuthenticated, 
  userEmail, 
  conversationId,
  modelMode: externalModelMode,
  onModelModeChange
}: ChatInterfaceProps) {
  const t = useTranslations();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [guestQueryUsed, setGuestQueryUsed] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(conversationId);
  const [sending, setSending] = useState(false);
  const [modelMode, setModelMode] = useState<'standard' | 'mini'>(externalModelMode || 'mini');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Custom hooks
  const { messages, loading, addMessage, addMessages, setMessages, markConversationAsJustCreated } = useChatMessages(isAuthenticated, currentConversationId);
  const { 
    steps: pipelineSteps, 
    showPipeline, 
    updateStep: updatePipelineStep, 
    resetSteps, 
    showPipelineUI, 
    hidePipelineUI,
    hidePipelineAfterDelay 
  } = usePipelineSteps();
  
  // Debug log
  console.log('[ChatInterface] pipelineSteps:', pipelineSteps, 'type:', typeof pipelineSteps, 'isArray:', Array.isArray(pipelineSteps));
  
  const { 
    enhancements: messageEnhancements, 
    messageView, 
    loadingStates: loadingEnhancements,
    simplifyMessage,
    summarizeMessage,
    translateMessage,
    getMessageContent: getEnhancedContent,
    setView: setMessageView
  } = useMessageEnhancements();
  const { detectedLanguage, detecting: detectingLanguage, detectLanguage, getLanguageName } = useLanguageDetection();
  const { executeRAGQuery } = useRAGQuery();
  const { isSupported: voiceOutputSupported, isSpeaking, missingVoiceWarning, speak, stop: stopSpeaking } = useVoiceOutput();
  const { streamingEnabled } = useStreamingSettings();
  const { embed: generateEmbedding } = useEmbedding();
  const { 
    isStreaming, 
    streamedContent, 
    currentStatus: streamingStatus,
    executeStreamingQuery 
  } = useStreamingRAG({
    onChunk: (chunk) => {
      // Update streaming message content in real-time
      console.log('[ChatInterface] Streaming chunk:', chunk);
    },
    onStatus: (status) => {
      console.log('[ChatInterface] Streaming status:', status);
      // Update pipeline step based on status
      if (status.step === 'searching') {
        updatePipelineStep(4, 'active');
      } else if (status.step === 'reranking') {
        updatePipelineStep(5, 'active');
      } else if (status.step === 'building_context') {
        updatePipelineStep(6, 'active');
      } else if (status.step === 'generating') {
        updatePipelineStep(7, 'active');
      }
    },
    onSources: (sources) => {
      console.log('[ChatInterface] Streaming sources:', sources.length);
      updatePipelineStep(4, 'completed', `${sources.length} candidates`);
      updatePipelineStep(5, 'completed', `${sources.length} docs found`);
    },
    onConfidence: (confidence) => {
      console.log('[ChatInterface] Streaming confidence:', confidence);
    },
    onComplete: (message) => {
      console.log('[ChatInterface] Streaming complete:', message);
      updatePipelineStep(7, 'completed');
      hidePipelineAfterDelay();
    },
    onError: (error) => {
      console.error('[ChatInterface] Streaming error:', error);
      hidePipelineUI();
    }
  });

  // Sync conversationId prop to state when it changes (from Sidebar selection)
  useEffect(() => {
    if (conversationId && conversationId !== currentConversationId) {
      setCurrentConversationId(conversationId);
    }
  }, [conversationId, currentConversationId]);

  // Sync external model mode changes
  useEffect(() => {
    if (externalModelMode && externalModelMode !== modelMode) {
      setModelMode(externalModelMode);
    }
  }, [externalModelMode, modelMode]);

  // Notify parent of model mode changes
  useEffect(() => {
    if (onModelModeChange) {
      onModelModeChange(modelMode);
    }
  }, [modelMode, onModelModeChange]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Helper function to continue with RAG after normalization decision
  async function continueWithRAG(queryText: string, conversationIdParam?: string) {
    try {
      // Use streaming or non-streaming based on user preference
      if (streamingEnabled) {
        await continueWithStreamingRAG(queryText, conversationIdParam);
      } else {
        await continueWithNonStreamingRAG(queryText, conversationIdParam);
      }
    } catch (error) {
      console.error('[ChatInterface] Error in RAG pipeline:', error);
      throw error;
    }
  }

  // Non-streaming RAG (original implementation)
  async function continueWithNonStreamingRAG(queryText: string, conversationIdParam?: string) {
    const result = await executeRAGQuery(
      queryText,
      conversationIdParam || currentConversationId,
      {
        onStepUpdate: updatePipelineStep,
        modelMode
      }
    );
    
    // Update conversation ID if it was created
    if (result.conversationId !== currentConversationId) {
      setCurrentConversationId(result.conversationId);
      markConversationAsJustCreated();
    }
    
    // Add messages to UI
    addMessages([result.userMessage, result.assistantMessage]);
    
    // Auto-translate assistant response if dialect was detected
    if (detectedLanguage?.dialect && result.assistantMessage.id) {
      console.log('[ChatInterface] Auto-translating response to', detectedLanguage.dialect);
      setTimeout(() => {
        translateMessage(
          result.assistantMessage.id,
          result.assistantMessage.content,
          detectedLanguage.language,
          detectedLanguage.dialect!
        );
      }, 500);
    }
  }

  // Streaming RAG (new implementation)
  async function continueWithStreamingRAG(queryText: string, conversationIdParam?: string) {
    let convId = conversationIdParam || currentConversationId;
    
    // If no conversation ID, create one first
    if (!convId) {
      console.log('[ChatInterface] No conversation ID, creating new conversation...');
      try {
        const response = await fetch('/api/chat/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Chat' })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create conversation: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        if (!data.conversation?.id) {
          throw new Error('Invalid response: missing conversation ID');
        }
        
        convId = data.conversation.id;
        setCurrentConversationId(convId);
        markConversationAsJustCreated();
        console.log('[ChatInterface] Created new conversation:', convId);
      } catch (error) {
        console.error('[ChatInterface] Error creating conversation:', error);
        hidePipelineUI();
        throw error; // Re-throw to be caught by handleSendMessage
      }
    }
    
    // Verify we have a conversation ID before proceeding
    if (!convId) {
      const error = new Error('No conversation ID available');
      console.error('[ChatInterface]', error.message);
      hidePipelineUI();
      throw error;
    }
    
    // Generate embedding for query using the hook
    updatePipelineStep(3, 'active');
    const embedding = await generateEmbedding(queryText);
    updatePipelineStep(3, 'completed');
    
    // Create temporary streaming message
    const tempStreamingMessage = {
      id: `streaming-${Date.now()}`,
      role: 'assistant' as const,
      content: '',
      created_at: new Date().toISOString(),
      isStreaming: true
    };
    
    addMessage(tempStreamingMessage);
    
    // Execute streaming query
    const result = await executeStreamingQuery(
      convId,
      queryText,
      embedding,
      modelMode
    );
    
    // Update conversation ID if needed
    if (result.assistantMessage) {
      const newConvId = (result.assistantMessage as any).conversation_id || convId;
      if (newConvId !== currentConversationId) {
        setCurrentConversationId(newConvId);
        markConversationAsJustCreated();
      }
    }
    
    // Remove temporary streaming message and add final messages
    if (result.userMessage && result.assistantMessage) {
      // Filter out the temporary streaming message
      setMessages(prev => prev.filter(m => !m.id.startsWith('streaming-')));
      // Add the final messages
      addMessages([result.userMessage, result.assistantMessage]);
      
      // Auto-translate if dialect detected
      if (detectedLanguage?.dialect && result.assistantMessage.id) {
        setTimeout(() => {
          translateMessage(
            result.assistantMessage!.id,
            result.assistantMessage!.content,
            detectedLanguage.language,
            detectedLanguage.dialect!
          );
        }, 500);
      }
    }
  }

  const handleSendMessage = async () => {
    if (!input.trim() || sending) return;

    // Check if guest has already used their free query
    if (!isAuthenticated && guestQueryUsed) {
      setShowSignInModal(true);
      return;
    }

    const userMessageContent = input.trim();
    setInput('');
    setSending(true);
    
    // Reset and show pipeline
    resetSteps();
    showPipelineUI();

    try {
      if (!isAuthenticated) {
        // Guest mode - just show locally
        const tempUserMessage = {
          id: Date.now().toString(),
          role: 'user' as const,
          content: userMessageContent,
          created_at: new Date().toISOString()
        };
        addMessage(tempUserMessage);
        
        // Simulate AI response
        setTimeout(() => {
          const tempAssistantMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant' as const,
            content: t('chat.signInToGetResponse'),
            created_at: new Date().toISOString()
          };
          addMessage(tempAssistantMessage);
          // Mark that guest has used their free query AFTER showing the response
          setGuestQueryUsed(true);
        }, 1000);
      } else {
        // Step 1: Language & Dialect Detection
        console.log('[ChatInterface] Step 1: Detecting language...');
        updatePipelineStep(1, 'active');
        
        const detected = await detectLanguage(userMessageContent);
        
        if (detected) {
          console.log(`[ChatInterface] ✅ Detected: ${detected.language}${detected.dialect ? ` (${detected.dialect})` : ''}`);
          updatePipelineStep(1, 'completed', `${getLanguageName(detected.language)}${detected.dialect ? ` (${detected.dialect})` : ''}`);
          
          // Don't show system message - just log it
          // Language detection is shown in the pipeline UI
        } else {
          updatePipelineStep(1, 'skipped');
        }

        // Step 2: Query Optimization (rewrite for better retrieval)
        console.log('[ChatInterface] Step 2: Optimizing query...');
        updatePipelineStep(2, 'active');
        
        let optimizedQuery = userMessageContent;
        try {
          const rewriteResult = await nlpApi.rewriteQuery(
            userMessageContent,
            detectedLanguage?.language || 'en',
            detectedLanguage?.dialect,
            'en' // Documents are primarily in English
          );

          if (rewriteResult.confidence >= 0.7 && rewriteResult.rewritten !== userMessageContent) {
            optimizedQuery = rewriteResult.rewritten;
            console.log(`[ChatInterface] ✅ Query optimized (${rewriteResult.added_keywords.length} keywords added)`);
            updatePipelineStep(2, 'completed', `+${rewriteResult.added_keywords.length} keywords`);
          } else {
            console.log('[ChatInterface] ✅ Query already optimal');
            updatePipelineStep(2, 'completed', 'Already optimal');
          }
        } catch (error) {
          console.error('[ChatInterface] Query optimization failed:', error);
          updatePipelineStep(2, 'skipped');
          // Continue with original query
        }

        // Continue with RAG using optimized query
        await continueWithRAG(optimizedQuery);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore input on error
      setInput(userMessageContent);
      hidePipelineUI();
    } finally {
      setSending(false);
      // Hide pipeline after a delay
      hidePipelineAfterDelay();
    }
  };

  // Get current display content for a message
  function getMessageContent(messageId: string, originalContent: string): string {
    // Check if this is the streaming message
    if (messageId.startsWith('streaming-') && isStreaming) {
      return streamedContent || 'Thinking...';
    }
    
    return getEnhancedContent(messageId, originalContent);
  }

  // Handle voice input transcript
  const handleVoiceTranscript = (transcript: string) => {
    console.log('[ChatInterface] Voice transcript:', transcript);
    setInput(transcript);
  };

  // Get BCP 47 language code for voice input (uses detected language from user query)
  const getVoiceLanguageCode = (): string => {
    if (!detectedLanguage) return 'en-US';
    
    const languageMap: Record<string, string> = {
      'en': 'en-US',
      'ms': 'ms-MY',
      'id': 'id-ID',
      'tl': 'tl-PH',
      'ta': 'ta-IN',
      'zh': 'zh-CN'
    };
    
    return languageMap[detectedLanguage.language] || 'en-US';
  };

  // Detect language from text content for voice output
  const detectLanguageFromText = (text: string): string => {
    // Simple heuristic-based language detection for voice output
    // Check for Chinese characters
    if (/[\u4e00-\u9fa5]/.test(text)) {
      return 'zh-CN';
    }
    // Check for Tamil script
    if (/[\u0B80-\u0BFF]/.test(text)) {
      return 'ta-IN';
    }
    // Check for common Malay words
    if (/\b(dan|atau|dengan|untuk|yang|ini|itu|adalah|tidak|ada|saya|anda|mereka)\b/i.test(text)) {
      return 'ms-MY';
    }
    // Check for common Indonesian words
    if (/\b(dan|atau|dengan|untuk|yang|ini|itu|adalah|tidak|ada|saya|anda|mereka|juga|akan)\b/i.test(text)) {
      return 'id-ID';
    }
    // Check for common Tagalog words
    if (/\b(at|o|sa|ng|ang|na|ay|mga|ako|ikaw|sila|hindi|oo)\b/i.test(text)) {
      return 'tl-PH';
    }
    // Default to English
    return 'en-US';
  };

  // Handle play/stop voice output for a message
  const handleVoiceOutput = (messageId: string, content: string) => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      // Detect language from the message content itself
      const languageCode = detectLanguageFromText(content);
      console.log('[ChatInterface] Voice output language detected:', languageCode, 'for content:', content.substring(0, 50));
      speak(content, { language: languageCode });
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl mx-auto space-y-8 flex flex-col pb-32">
          {/* Pipeline Progress Indicator */}
          {showPipeline && (
            <div className="bg-(--color-bg-secondary) border border-(--color-border) rounded-lg p-4 shadow-sm animate-fadeIn">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  <img src="/notextlogo.png" alt="DocsBridge" className="w-full h-full object-contain" />
                </div>
                <h4 className="text-sm font-semibold text-(--color-text-primary)">DocsBridge AI</h4>
              </div>
              <div className="space-y-2">
                {pipelineSteps && pipelineSteps.map((step) => (
                  <div key={step.id} className="flex items-center gap-3 animate-fadeIn">
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      {step.status === 'completed' && (
                        <span className="text-green-500 text-lg">✓</span>
                      )}
                      {step.status === 'active' && (
                        <div className="w-4 h-4 border-2 border-(--color-accent) border-t-transparent rounded-full animate-spin"></div>
                      )}
                      {step.status === 'skipped' && (
                        <span className="text-(--color-text-secondary) text-lg">−</span>
                      )}
                      {step.status === 'pending' && (
                        <span className="text-(--color-text-secondary) text-lg">○</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${
                          step.status === 'completed' ? 'text-green-600 dark:text-green-400 font-medium' :
                          step.status === 'active' ? 'text-(--color-accent) font-medium' :
                          step.status === 'skipped' ? 'text-(--color-text-secondary) line-through' :
                          'text-(--color-text-secondary)'
                        }`}>
                          {step.name}
                        </span>
                        {step.result && (
                          <span className="text-[10px] text-(--color-text-secondary)">
                            {step.result}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-4 border-(--color-accent) border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : messages.length === 0 && !showPipeline ? (
            <div className="flex justify-start">
              <div className="shrink-0 mr-4">
                <div className="w-8 h-8 flex items-center justify-center mt-1 rounded p-1">
                  <img src="/notextlogo.png" alt={t('common.appName')} className="w-full h-full object-contain" />
                </div>
              </div>
              <div className="max-w-[85%] sm:max-w-[80%]">
                <div className="text-(--color-text-primary) bg-(--color-message-ai-bg) p-5 rounded-2xl rounded-tl-sm shadow-sm border border-(--color-message-ai-border) chat-message">
                  <p className="mb-3 text-lg font-medium">{t('chat.welcome')}</p>
                  <p className="mb-4 text-(--color-text-secondary)">
                    {t('chat.welcomeDescription')}
                  </p>
                  {!isAuthenticated && (
                    <p className="mb-4 text-sm text-(--color-text-secondary)">
                      {t('chat.freeQueryRemaining')}
                    </p>
                  )}
                  <p className="mb-4 text-sm text-(--color-text-secondary)">
                    {t('chat.typeOrVoice')}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {[
                      t('chat.topics.healthcare'),
                      t('chat.topics.cashAid'),
                      t('chat.topics.education'),
                      t('chat.topics.housing')
                    ].map((topic) => (
                      <button
                        key={topic}
                        onClick={() => setInput(topic)}
                        className="px-3 py-1.5 bg-(--color-bg-secondary) text-(--color-accent) rounded-full text-sm hover:bg-(--color-bg-tertiary) transition-colors border border-(--color-border) shadow-sm font-medium cursor-pointer"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : message.role === 'system' ? 'justify-center' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  <div className="shrink-0 mr-4">
                    <div className="w-8 h-8 bg-(--color-bg-secondary) rounded-full flex items-center justify-center shadow-md mt-1 border border-(--color-border) p-1">
                      <img src="/notextlogo.png" alt={t('common.appName')} className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}
                <div className={`max-w-[85%] ${message.role === 'user' ? 'sm:max-w-[75%]' : message.role === 'system' ? 'sm:max-w-[60%]' : 'sm:max-w-[80%]'}`}>
                  <div
                    className={`p-4 rounded-2xl shadow-md chat-message ${
                      message.role === 'user'
                        ? 'bg-(--color-message-user-bg) text-(--color-message-user-text) rounded-tr-sm'
                        : message.role === 'system'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-sm'
                        : 'bg-(--color-message-ai-bg) text-(--color-message-ai-text) rounded-tl-sm border border-(--color-message-ai-border)'
                    }`}
                  >
                    {/* Action buttons for assistant messages */}
                    {message.role === 'assistant' && (
                      <>
                        <div className="flex gap-2 mb-3 flex-wrap">
                          {/* Voice output button */}
                          {voiceOutputSupported && (
                            <button
                              onClick={() => handleVoiceOutput(message.id, getMessageContent(message.id, message.content))}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-(--color-bg-secondary) text-(--color-text-primary) rounded-full text-sm hover:bg-(--color-bg-tertiary) transition-colors border border-(--color-border) shadow-sm font-medium cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-base text-(--color-accent)">{isSpeaking ? 'stop_circle' : 'volume_up'}</span>
                              {isSpeaking ? 'Stop Playing' : 'Play Response'}
                            </button>
                          )}
                          
                          {/* Translate button - toggles between original and translated */}
                          {detectedLanguage?.dialect && (
                            <button
                              onClick={() => {
                                if (messageView[message.id] === 'translated') {
                                  setMessageView(message.id, 'original');
                                } else {
                                  translateMessage(message.id, message.content, detectedLanguage.language, detectedLanguage.dialect!);
                                }
                              }}
                              disabled={loadingEnhancements[message.id]?.translating}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-(--color-bg-secondary) text-(--color-text-primary) rounded-full text-sm hover:bg-(--color-bg-tertiary) transition-colors border border-(--color-border) shadow-sm font-medium cursor-pointer disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-base text-(--color-accent)">
                                {loadingEnhancements[message.id]?.translating ? 'sync' : 'translate'}
                              </span>
                              {loadingEnhancements[message.id]?.translating 
                                ? 'Translating...' 
                                : messageView[message.id] === 'translated'
                                ? 'Show Original'
                                : `Translate to ${detectedLanguage.dialect}`
                              }
                            </button>
                          )}
                          
                          {/* Simplify button */}
                          <button
                            onClick={() => {
                              if (messageView[message.id] === 'simplified') {
                                setMessageView(message.id, 'original');
                              } else {
                                simplifyMessage(message.id, message.content);
                              }
                            }}
                            disabled={loadingEnhancements[message.id]?.simplifying}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-(--color-bg-secondary) text-(--color-text-primary) rounded-full text-sm hover:bg-(--color-bg-tertiary) transition-colors border border-(--color-border) shadow-sm font-medium cursor-pointer disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-base text-(--color-accent)">
                              {loadingEnhancements[message.id]?.simplifying ? 'sync' : messageView[message.id] === 'simplified' ? 'description' : 'auto_awesome'}
                            </span>
                            {loadingEnhancements[message.id]?.simplifying 
                              ? 'Simplifying...' 
                              : messageView[message.id] === 'simplified'
                              ? 'Show Original'
                              : 'Simplify Professional Words'
                            }
                          </button>
                          
                          {/* Summarize Overall button */}
                          {message.content.length > 500 && (
                            <button
                              onClick={() => summarizeMessage(message.id, message.content, 'tldr')}
                              disabled={loadingEnhancements[message.id]?.summarizingTldr}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-(--color-bg-secondary) text-(--color-text-primary) rounded-full text-sm hover:bg-(--color-bg-tertiary) transition-colors border border-(--color-border) shadow-sm font-medium cursor-pointer disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-base text-(--color-accent)">
                                {loadingEnhancements[message.id]?.summarizingTldr ? 'sync' : 'summarize'}
                              </span>
                              {loadingEnhancements[message.id]?.summarizingTldr ? 'Summarizing...' : 'Summarize Overall'}
                            </button>
                          )}
                          
                          {/* Summarize in Point Form button */}
                          {message.content.length > 500 && (
                            <button
                              onClick={() => summarizeMessage(message.id, message.content, 'bullet_points')}
                              disabled={loadingEnhancements[message.id]?.summarizingBullets}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-(--color-bg-secondary) text-(--color-text-primary) rounded-full text-sm hover:bg-(--color-bg-tertiary) transition-colors border border-(--color-border) shadow-sm font-medium cursor-pointer disabled:opacity-50"
                            >
                              <span className="material-symbols-outlined text-base text-(--color-accent)">
                                {loadingEnhancements[message.id]?.summarizingBullets ? 'sync' : 'format_list_bulleted'}
                              </span>
                              {loadingEnhancements[message.id]?.summarizingBullets ? 'Summarizing...' : 'Summarize in Point Form'}
                            </button>
                          )}
                        </div>
                        
                        {/* Voice warning message */}
                        {missingVoiceWarning && (
                          <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                            <div className="flex items-start gap-2">
                              <span className="text-orange-600 dark:text-orange-400 text-lg shrink-0">⚠️</span>
                              <div className="flex-1">
                                <p className="text-sm text-orange-700 dark:text-orange-300 font-medium mb-1">
                                  {missingVoiceWarning}
                                </p>
                                <p className="text-xs text-orange-600 dark:text-orange-400">
                                  To get better voice quality, install the language voice pack in your system settings.
                                </p>
                                <details className="mt-2">
                                  <summary className="text-xs text-orange-600 dark:text-orange-400 cursor-pointer hover:underline">
                                    How to install voice packs
                                  </summary>
                                  <div className="mt-2 text-xs text-orange-600 dark:text-orange-400 space-y-1">
                                    <p><strong>Windows:</strong> Settings → Time & Language → Speech → Add voices</p>
                                    <p><strong>macOS:</strong> System Preferences → Accessibility → Spoken Content → Manage Voices</p>
                                    <p><strong>Android/iOS:</strong> Usually pre-installed, check system language settings</p>
                                  </div>
                                </details>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Message content with difficult words highlighting for simplified view */}
                    {message.role === 'assistant' && messageView[message.id] === 'simplified' && messageEnhancements[message.id]?.simplified?.difficult_words ? (
                      <DifficultWordsText
                        text={getMessageContent(message.id, message.content)}
                        difficultWords={messageEnhancements[message.id]!.simplified!.difficult_words}
                        className="whitespace-pre-wrap"
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {getMessageContent(message.id, message.content)}
                        {/* Streaming cursor */}
                        {message.id.startsWith('streaming-') && isStreaming && (
                          <span className="inline-block w-2 h-4 ml-1 bg-(--color-accent) animate-pulse"></span>
                        )}
                      </p>
                    )}
                    
                    {/* Readability score for simplified view with comparison */}
                    {message.role === 'assistant' && messageView[message.id] === 'simplified' && messageEnhancements[message.id]?.simplified?.readability_score && (
                      <div className="mt-3 p-2 bg-(--color-bg-secondary) rounded-lg border border-(--color-border)">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-lg">📊</span>
                          <div className="flex-1">
                            <div className="font-semibold text-(--color-text-primary)">
                              Readability: Grade {messageEnhancements[message.id]!.simplified!.readability_score.simplified.toFixed(1)}
                            </div>
                            <div className="text-(--color-text-secondary) mt-0.5">
                              Original: Grade {messageEnhancements[message.id]!.simplified!.readability_score.original.toFixed(1)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-green-600 dark:text-green-400 font-semibold">
                              {(() => {
                                const original = messageEnhancements[message.id]!.simplified!.readability_score.original;
                                const simplified = messageEnhancements[message.id]!.simplified!.readability_score.simplified;
                                const improvement = ((original - simplified) / original * 100);
                                return improvement > 0 ? `${improvement.toFixed(0)}% easier` : 'Simplified';
                              })()}
                            </div>
                          </div>
                        </div>
                        {messageEnhancements[message.id]!.simplified!.difficult_words.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-(--color-border) text-[11px] text-(--color-text-secondary)">
                            💡 Tip: Hover over <span className="underline decoration-dashed">underlined words</span> to see explanations
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Translation confidence display */}
                    {message.role === 'assistant' && messageView[message.id] === 'translated' && messageEnhancements[message.id]?.translations && (
                      <div className="mt-3 p-2 bg-(--color-bg-secondary) rounded-lg border border-(--color-border)">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-lg">🌐</span>
                          <div className="flex-1">
                            <div className="font-semibold text-(--color-text-primary)">
                              Translation Quality
                            </div>
                            {(() => {
                              const translations = messageEnhancements[message.id]!.translations!;
                              const translationKey = Object.keys(translations)[0];
                              const translation = translations[translationKey];
                              const confidence = translation?.confidence || 0;
                              
                              return (
                                <>
                                  <div className="text-(--color-text-secondary) mt-0.5">
                                    Confidence: {(confidence * 100).toFixed(0)}%
                                  </div>
                                  {confidence < 0.8 && (
                                    <div className="mt-1 text-orange-600 dark:text-orange-400 text-[11px]">
                                      ⚠️ Low confidence - translation may not be fully accurate
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          <div className="text-right">
                            {(() => {
                              const translations = messageEnhancements[message.id]!.translations!;
                              const translationKey = Object.keys(translations)[0];
                              const translation = translations[translationKey];
                              const confidence = translation?.confidence || 0;
                              
                              if (confidence >= 0.9) {
                                return <span className="text-green-600 dark:text-green-400 font-semibold">✓ High</span>;
                              } else if (confidence >= 0.7) {
                                return <span className="text-yellow-600 dark:text-yellow-400 font-semibold">~ Medium</span>;
                              } else {
                                return <span className="text-orange-600 dark:text-orange-400 font-semibold">! Low</span>;
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Summarization display (when summary exists) */}
                    {message.role === 'assistant' && messageEnhancements[message.id]?.summary && (
                      <div className="mt-4 pt-4 border-t border-(--color-border)">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-(--color-text-secondary) mb-2">Key Points:</p>
                            <ul className="list-disc list-inside space-y-1">
                              {messageEnhancements[message.id]!.summary!.bullet_points.map((point, idx) => (
                                <li key={idx} className="text-xs text-(--color-text-primary)">{point}</li>
                              ))}
                            </ul>
                          </div>
                          
                          {messageEnhancements[message.id]!.summary!.key_actions.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-(--color-text-secondary) mb-2">Actions to Take:</p>
                              <ol className="list-decimal list-inside space-y-1">
                                {messageEnhancements[message.id]!.summary!.key_actions.map((action, idx) => (
                                  <li key={idx} className="text-xs text-(--color-text-primary)">{action}</li>
                                ))}
                              </ol>
                            </div>
                          )}
                          
                          <p className="text-[11px] text-(--color-text-secondary)">
                            📊 Reduced from {messageEnhancements[message.id]!.summary!.word_count.original} to {messageEnhancements[message.id]!.summary!.word_count.summary} words 
                            ({messageEnhancements[message.id]!.summary!.word_count.reduction}% shorter)
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Display confidence score if available */}
                    {message.confidence && (
                      <div className="mt-3 pt-3 border-t border-(--color-border)">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">
                            {message.confidence.level === 'high' ? '🟢' : 
                             message.confidence.level === 'medium' ? '🟡' : '🔴'}
                          </span>
                          <span className="text-xs font-semibold text-(--color-text-secondary)">
                            Confidence: {(message.confidence.overall * 100).toFixed(0)}% ({message.confidence.level})
                          </span>
                        </div>
                        <p className="text-[11px] text-(--color-text-secondary)">
                          {message.confidence.explanation}
                        </p>
                      </div>
                    )}

                    {/* Display sources if available */}
                    {message.sources && message.sources.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-(--color-border)">
                        <p className="text-xs font-semibold text-(--color-text-secondary) mb-2">
                          📚 Sources ({message.sources.length})
                        </p>
                        <div className="space-y-2">
                          {message.sources.map((source, idx) => (
                            <div 
                              key={source.chunk_id}
                              onClick={() => {
                                if (isAuthenticated && source.document_id) {
                                  router.push(`/knowledge-base?doc=${source.document_id}`);
                                }
                              }}
                              className={`text-xs bg-(--color-bg-secondary) p-2 rounded border border-(--color-border) transition-all ${
                                isAuthenticated && source.document_id 
                                  ? 'cursor-pointer hover:bg-(--color-bg-tertiary) hover:border-(--color-accent) hover:shadow-md' 
                                  : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="font-medium text-(--color-accent)">
                                  {idx + 1}. {source.title}
                                </span>
                                <span className="text-(--color-text-secondary) shrink-0">
                                  {(source.similarity * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-(--color-text-secondary) text-[11px] mb-1">
                                {source.chunk_text}
                              </p>
                              <div className="flex items-center justify-between gap-2">
                                {source.source_url && (
                                  <a 
                                    href={source.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-(--color-accent) hover:underline text-[10px] inline-block"
                                  >
                                    View external source →
                                  </a>
                                )}
                                {isAuthenticated && source.document_id && (
                                  <span className="text-(--color-accent) text-[10px] font-medium">
                                    📄 Click to view in KB →
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full bg-linear-to-t from-(--color-bg-primary) via-(--color-bg-primary) to-transparent pt-6 pb-6 px-4">
        <div className="max-w-3xl mx-auto relative flex items-center gap-2">
          <button
            aria-label={t('chat.attachFile')}
            className="p-2 text-(--color-text-secondary) hover:text-(--color-accent) hover:bg-(--color-bg-secondary) rounded-lg transition-colors shrink-0 border border-transparent hover:border-(--color-border) hover:shadow-sm cursor-pointer"
            disabled={sending}
          >
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          <div className="relative flex-1 bg-(--color-input-bg) border-2 border-(--color-input-border) rounded-xl shadow-sm focus-within:ring-0 focus-within:border-(--color-input-focus) transition-colors overflow-hidden min-h-[56px] flex items-center">
            <textarea
              className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 pl-4 pr-12 text-(--color-text-primary) placeholder-(--color-text-secondary) outline-none"
              placeholder={t('chat.messagePlaceholder')}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={sending}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <VoiceInput
                onTranscript={handleVoiceTranscript}
                disabled={sending}
                language={getVoiceLanguageCode()}
              />
            </div>
          </div>
          <button
            aria-label={t('chat.sendMessage')}
            onClick={handleSendMessage}
            disabled={sending || detectingLanguage || !input.trim()}
            className="w-12 h-12 bg-(--color-button-primary-bg) text-(--color-button-primary-text) rounded-xl flex items-center justify-center hover:bg-(--color-button-primary-hover) transition-colors shrink-0 focus:outline-none shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending || detectingLanguage ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="material-symbols-outlined text-[20px]">send</span>
            )}
          </button>
        </div>
        <div className="max-w-3xl mx-auto text-center mt-3">
          <span className="text-xs font-medium text-(--color-text-secondary)">
            {t('chat.aiDisclaimer')}
          </span>
        </div>
      </div>

      {showSignInModal && <SignInModal onClose={() => setShowSignInModal(false)} />}
    </>
  );
}
