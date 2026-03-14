'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import SignInModal from '../auth/SignInModal';
import PipelineProgress from './PipelineProgress';
import WelcomeMessage from './WelcomeMessage';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import WordExplanationSidebar from './WordExplanationSidebar';
import * as nlpApi from '@/lib/api/nlp';
import { useChatMessages } from '@/hooks/useChatMessages';
import { usePipelineSteps } from '@/hooks/usePipelineSteps';
import { useMessageEnhancements } from '@/hooks/useMessageEnhancements';
import { useLanguageDetection } from '@/hooks/useLanguageDetection';
import { useVoiceOutput } from '@/hooks/useVoiceOutput';
import { useStreamingRAG } from '@/hooks/useStreamingRAG';
import { useClientEmbedding } from '@/hooks/useClientEmbedding';
import { useGuestMode } from '@/hooks/useGuestMode';
import { useFileAttachment } from '@/hooks/useFileAttachment';
import { useWordExplanation } from '@/hooks/useWordExplanation';

interface ChatInterfaceProps {
  isAuthenticated: boolean;
  userEmail?: string;
  conversationId?: string;
  modelMode?: 'standard' | 'mini';
  onModelModeChange?: (mode: 'standard' | 'mini') => void;
}

export default function ChatInterface({ 
  isAuthenticated, 
  conversationId,
  modelMode: externalModelMode,
  onModelModeChange
}: ChatInterfaceProps) {
  
  // Basic state
  const [input, setInput] = useState('');
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(conversationId);
  const [sending, setSending] = useState(false);
  const [modelMode, setModelMode] = useState<'standard' | 'mini'>(externalModelMode || 'mini');
  
  // Custom hooks
  const { guestQueryUsed, setGuestQueryUsed, migrateGuestConversation } = useGuestMode(isAuthenticated);
  const fileAttachment = useFileAttachment();
  const wordExplanation = useWordExplanation();
  const { messages, loading, addMessage, addMessages, setMessages, markConversationAsJustCreated } = useChatMessages(isAuthenticated, currentConversationId);
  const pipeline = usePipelineSteps();
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
  const { isSupported: voiceOutputSupported, isSpeaking, missingVoiceWarning, speak, stop: stopSpeaking } = useVoiceOutput();
  const { generateEmbeddingWithCache } = useClientEmbedding();
  const { 
    isStreaming, 
    streamedContent,
    executeStreamingQuery 
  } = useStreamingRAG({
    onChunk: (chunk) => {
      console.log('[ChatInterface] Streaming chunk:', chunk);
    },
    onStatus: (status) => {
      console.log('[ChatInterface] Streaming status:', status);
      if (status.step === 'searching') {
        pipeline.updateStep(4, 'active');
      } else if (status.step === 'reranking') {
        pipeline.updateStep(5, 'active');
      } else if (status.step === 'building_context') {
        pipeline.updateStep(6, 'active');
      } else if (status.step === 'generating') {
        pipeline.updateStep(7, 'active');
      }
    },
    onSources: (sources) => {
      console.log('[ChatInterface] Streaming sources:', sources.length);
      pipeline.updateStep(4, 'completed', `${sources.length} candidates`);
      pipeline.updateStep(5, 'completed', `${sources.length} docs found`);
    },
    onConfidence: (confidence) => {
      console.log('[ChatInterface] Streaming confidence:', confidence);
    },
    onComplete: (message) => {
      console.log('[ChatInterface] Streaming complete:', message);
      pipeline.updateStep(7, 'completed');
      pipeline.hidePipelineAfterDelay();
    },
    onError: (error) => {
      console.error('[ChatInterface] Streaming error:', error);
      pipeline.hidePipelineUI();
    }
  });

  // Sync conversationId prop to state
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

  // Migrate guest conversation after login
  useEffect(() => {
    if (isAuthenticated) {
      migrateGuestConversation();
    }
  }, [isAuthenticated, migrateGuestConversation]);

  // Helper function to continue with RAG after normalization decision
  async function continueWithRAG(queryText: string, conversationIdParam?: string, originalQuery?: string) {
    try {
      await continueWithStreamingRAG(queryText, conversationIdParam, originalQuery);
    } catch (error) {
      console.error('[ChatInterface] Error in RAG pipeline:', error);
      throw error;
    }
  }

  // Streaming RAG implementation
  async function continueWithStreamingRAG(queryText: string, conversationIdParam?: string, originalQuery?: string) {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    console.log(`[ChatInterface] continueWithStreamingRAG START - RequestID: ${requestId}`);
    
    let convId = conversationIdParam || currentConversationId;
    
    // If no conversation ID, create one
    if (!convId) {
      if (isAuthenticated) {
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
          pipeline.hidePipelineUI();
          throw error;
        }
      } else {
        convId = `guest-${Date.now()}`;
        console.log('[ChatInterface] Guest user, using temporary conversation ID:', convId);
      }
    }
    
    if (!convId) {
      const error = new Error('No conversation ID available');
      console.error('[ChatInterface]', error.message);
      pipeline.hidePipelineUI();
      throw error;
    }
    
    // Generate embedding with cache check (client-side first, then server fallback)
    pipeline.updateStep(3, 'active');
    let embedding: number[];
    let embeddingSource: 'cache' | 'client' | 'server' = 'cache';
    
    try {
      // Try cache + client-side generation first
      const embeddingResult = await generateEmbeddingWithCache(queryText);
      embedding = embeddingResult.embedding;
      embeddingSource = embeddingResult.cached ? 'cache' : 'client';
      console.log(`[ChatInterface] Embedding generated from: ${embeddingSource}`);
    } catch (clientError) {
      console.warn('[ChatInterface] Client-side embedding failed, will use server fallback:', clientError);
      // Don't set embedding here - let server handle it
      embedding = []; // Empty array signals server to generate
      embeddingSource = 'server';
    }
    
    pipeline.updateStep(3, 'completed');
    
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
    console.log(`[ChatInterface] Calling executeStreamingQuery - RequestID: ${requestId}`);
    const result = await executeStreamingQuery(
      convId,
      queryText,
      embedding,
      modelMode,
      originalQuery
    );
    console.log(`[ChatInterface] executeStreamingQuery completed - RequestID: ${requestId}`);
    
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
      setMessages(prev => prev.filter(m => !m.id.startsWith('streaming-')));
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
    const sendMessageId = `send-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    console.log(`[ChatInterface] ========== handleSendMessage START - ID: ${sendMessageId} ==========`);
    
    if (!input.trim() || sending) {
      console.log(`[ChatInterface] ${sendMessageId} - Blocked: input empty or already sending`);
      return;
    }

    console.log(`[ChatInterface] ${sendMessageId} - isAuthenticated:`, isAuthenticated);
    console.log(`[ChatInterface] ${sendMessageId} - guestQueryUsed:`, guestQueryUsed);

    // Check if guest has already used their free query
    if (!isAuthenticated && guestQueryUsed) {
      console.log(`[ChatInterface] ${sendMessageId} - Guest query limit reached, showing sign-in modal`);
      setShowSignInModal(true);
      return;
    }

    const userMessageContent = input.trim();
    setInput('');
    setSending(true);
    
    console.log(`[ChatInterface] ${sendMessageId} - Processing message: "${userMessageContent.substring(0, 50)}..."`);
    
    // Reset and show pipeline
    pipeline.resetSteps();
    pipeline.showPipelineUI();

    try {
      if (!isAuthenticated) {
        console.log(`[ChatInterface] ${sendMessageId} - Processing as guest user`);
        
        // Add user message to UI
        const tempUserMessage = {
          id: Date.now().toString(),
          role: 'user' as const,
          content: userMessageContent,
          created_at: new Date().toISOString()
        };
        addMessage(tempUserMessage);
      }
      
      // Step 1: Language & Dialect Detection
      console.log(`[ChatInterface] ${sendMessageId} - Step 1: Detecting language...`);
      pipeline.updateStep(1, 'active');
      
      const detected = await detectLanguage(userMessageContent);
      
      if (detected) {
        console.log(`[ChatInterface] ${sendMessageId} - ✅ Detected: ${detected.language}${detected.dialect ? ` (${detected.dialect})` : ''}`);
        pipeline.updateStep(1, 'completed', `${getLanguageName(detected.language)}${detected.dialect ? ` (${detected.dialect})` : ''}`);
      } else {
        pipeline.updateStep(1, 'skipped');
      }

      // Step 2: Query Optimization
      console.log(`[ChatInterface] ${sendMessageId} - Step 2: Optimizing query...`);
      pipeline.updateStep(2, 'active');
      
      let optimizedQuery = userMessageContent;
      try {
        const rewriteResult = await nlpApi.rewriteQuery(
          userMessageContent,
          detectedLanguage?.language || 'en',
          detectedLanguage?.dialect,
          'en'
        );

        if (rewriteResult.confidence >= 0.7 && rewriteResult.rewritten !== userMessageContent) {
          optimizedQuery = rewriteResult.rewritten;
          console.log(`[ChatInterface] ${sendMessageId} - ✅ Query optimized (${rewriteResult.added_keywords.length} keywords added)`);
          pipeline.updateStep(2, 'completed', `+${rewriteResult.added_keywords.length} keywords`);
        } else {
          console.log(`[ChatInterface] ${sendMessageId} - ✅ Query already optimal`);
          pipeline.updateStep(2, 'completed', 'Already optimal');
        }
      } catch (error) {
        console.error(`[ChatInterface] ${sendMessageId} - Query optimization failed:`, error);
        pipeline.updateStep(2, 'skipped');
      }

      // Continue with RAG using optimized query
      console.log(`[ChatInterface] ${sendMessageId} - Calling continueWithRAG...`);
      await continueWithRAG(optimizedQuery, undefined, userMessageContent);
      console.log(`[ChatInterface] ${sendMessageId} - continueWithRAG completed`);
      
      // Mark guest as having used their query AFTER seeing the response
      if (!isAuthenticated) {
        console.log(`[ChatInterface] ${sendMessageId} - Guest has now seen response, marking as used`);
        setGuestQueryUsed();
      }
    } catch (error) {
      console.error(`[ChatInterface] ${sendMessageId} - Error sending message:`, error);
      setInput(userMessageContent);
      pipeline.hidePipelineUI();
    } finally {
      setSending(false);
      pipeline.hidePipelineAfterDelay();
      console.log(`[ChatInterface] ========== handleSendMessage END - ID: ${sendMessageId} ==========`);
    }
  };

  // Get current display content for a message
  function getMessageContent(messageId: string, originalContent: string): string {
    if (messageId.startsWith('streaming-') && isStreaming) {
      return streamedContent || 'Thinking...';
    }
    return getEnhancedContent(messageId, originalContent);
  }
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
    if (/[\u4e00-\u9fa5]/.test(text)) return 'zh-CN';
    if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
    if (/\b(dan|atau|dengan|untuk|yang|ini|itu|adalah|tidak|ada|saya|anda|mereka)\b/i.test(text)) return 'ms-MY';
    if (/\b(dan|atau|dengan|untuk|yang|ini|itu|adalah|tidak|ada|saya|anda|mereka|juga|akan)\b/i.test(text)) return 'id-ID';
    if (/\b(at|o|sa|ng|ang|na|ay|mga|ako|ikaw|sila|hindi|oo)\b/i.test(text)) return 'tl-PH';
    return 'en-US';
  };

  // Handle play/stop voice output for a message
  const handleVoiceOutput = (messageId: string, content: string) => {
    if (isSpeaking) {
      stopSpeaking();
    } else {
      const languageCode = detectLanguageFromText(content);
      console.log('[ChatInterface] Voice output language detected:', languageCode);
      speak(content, { language: languageCode });
    }
  };

  // Convert detectedLanguage to the expected type (null to undefined)
  const detectedLangForMessages = detectedLanguage ? {
    language: detectedLanguage.language,
    dialect: detectedLanguage.dialect || undefined
  } : undefined;

  // Handle message actions
  const handleTranslate = (messageId: string) => {
    if (messageView[messageId] === 'translated') {
      setMessageView(messageId, 'original');
    } else if (detectedLanguage?.dialect) {
      const message = messages.find(m => m.id === messageId);
      if (message) {
        translateMessage(messageId, message.content, detectedLanguage.language, detectedLanguage.dialect);
      }
    }
  };

  const handleSimplify = (messageId: string) => {
    if (messageView[messageId] === 'simplified') {
      setMessageView(messageId, 'original');
    } else {
      const message = messages.find(m => m.id === messageId);
      if (message) {
        simplifyMessage(messageId, message.content);
      }
    }
  };

  const handleSummarize = (messageId: string, format: 'tldr' | 'bullet_points') => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      summarizeMessage(messageId, message.content, format);
    }
  };

  const handleShowOriginal = (messageId: string) => {
    setMessageView(messageId, 'original');
  };

  return (
    <>
      <div className={`flex-1 overflow-y-auto px-4 py-8 transition-all duration-300 ${wordExplanation.showWordSidebar ? 'mr-96' : ''}`}>
        <div className="max-w-3xl mx-auto space-y-8 flex flex-col pb-32">
          {/* Pipeline Progress Indicator */}
          <PipelineProgress steps={pipeline.steps} show={pipeline.showPipeline} />
          
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-4 border-(--color-accent) border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : messages.length === 0 && !pipeline.showPipeline ? (
            <WelcomeMessage 
              isAuthenticated={isAuthenticated}
              onTopicClick={setInput}
            />
          ) : (
            <ChatMessages
              messages={messages}
              isStreaming={isStreaming}
              messageView={messageView}
              messageEnhancements={messageEnhancements}
              loadingStates={loadingEnhancements}
              detectedLanguage={detectedLangForMessages}
              voiceOutputSupported={voiceOutputSupported}
              isSpeaking={isSpeaking}
              missingVoiceWarning={missingVoiceWarning || undefined}
              isAuthenticated={isAuthenticated}
              getMessageContent={getMessageContent}
              onVoiceOutput={handleVoiceOutput}
              onTranslate={handleTranslate}
              onSimplify={handleSimplify}
              onSummarize={handleSummarize}
              onShowOriginal={handleShowOriginal}
              onWordClick={wordExplanation.handleWordClick}
            />
          )}
        </div>
      </div>

      <ChatInput
        input={input}
        setInput={setInput}
        sending={sending}
        detectingLanguage={detectingLanguage}
        onSend={handleSendMessage}
        onVoiceTranscript={setInput}
        voiceLanguageCode={getVoiceLanguageCode()}
        attachedFiles={fileAttachment.attachedFiles}
        onFileSelect={fileAttachment.handleFileSelect}
        onRemoveFile={fileAttachment.handleRemoveFile}
        onAttachClick={fileAttachment.handleAttachClick}
        fileInputRef={fileAttachment.fileInputRef}
        getFileIcon={fileAttachment.getFileIcon}
        formatFileSize={fileAttachment.formatFileSize}
      />

      <WordExplanationSidebar
        show={wordExplanation.showWordSidebar}
        selectedWord={wordExplanation.selectedWord}
        wordContext={wordExplanation.wordContext}
        wordExplanation={wordExplanation.wordExplanation}
        loadingExplanation={wordExplanation.loadingExplanation}
        onClose={wordExplanation.closeSidebar}
      />
      
      {showSignInModal && <SignInModal onClose={() => setShowSignInModal(false)} />}
    </>
  );
}
