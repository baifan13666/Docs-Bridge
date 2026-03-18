'use client';

import { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import * as nlpApi from '@/lib/api/nlp';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  isStreaming?: boolean;
  confidence?: {
    overall: number;
    level: 'high' | 'medium' | 'low';
    explanation: string;
  };
  sources?: Array<{
    chunk_id: string;
    document_id?: string;
    title: string;
    chunk_text: string;
    similarity: number;
    source_url?: string | null;
  }>;
}

interface ChatMessagesProps {
  messages: Message[];
  isStreaming: boolean;
  pipelineSteps?: { id: number; name: string; status: 'pending' | 'active' | 'completed' | 'skipped'; result?: string }[];
  pipelineShow?: boolean;
  messageView: { [messageId: string]: 'original' | 'simplified' | 'translated' };
  messageEnhancements: {
    [messageId: string]: {
      simplified?: nlpApi.SimplificationResult;
      summary?: nlpApi.SummarizationResult;
      translations?: { [key: string]: nlpApi.TranslationResult };
    };
  };
  loadingStates: {
    [messageId: string]: {
      simplifying?: boolean;
      summarizing?: boolean;
      summarizingTldr?: boolean;
      summarizingBullets?: boolean;
      translating?: boolean;
    };
  };
  detectedLanguage?: {
    language: string;
    dialect?: string;
  };
  voiceOutputSupported: boolean;
  isSpeaking: boolean;
  missingVoiceWarning?: string;
  isAuthenticated: boolean;
  getMessageContent: (messageId: string, originalContent: string) => string;
  onVoiceOutput: (messageId: string, content: string) => void;
  onTranslate: (messageId: string) => void;
  onSimplify: (messageId: string) => void;
  onSummarize: (messageId: string, format: 'tldr' | 'bullet_points') => void;
  onShowOriginal: (messageId: string) => void;
  onWordClick: (word: string, context: string) => void;
}

export default function ChatMessages({
  messages,
  isStreaming,
  pipelineSteps,
  pipelineShow,
  messageView,
  messageEnhancements,
  loadingStates,
  detectedLanguage,
  voiceOutputSupported,
  isSpeaking,
  missingVoiceWarning,
  isAuthenticated,
  getMessageContent,
  onVoiceOutput,
  onTranslate,
  onSimplify,
  onSummarize,
  onShowOriginal,
  onWordClick
}: ChatMessagesProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <>
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          isStreaming={isStreaming}
          pipelineSteps={pipelineSteps}
          pipelineShow={pipelineShow}
          messageView={messageView[message.id] || 'original'}
          messageContent={getMessageContent(message.id, message.content)}
          messageEnhancements={messageEnhancements[message.id]}
          loadingStates={loadingStates[message.id]}
          detectedLanguage={detectedLanguage}
          voiceOutputSupported={voiceOutputSupported}
          isSpeaking={isSpeaking}
          missingVoiceWarning={missingVoiceWarning}
          isAuthenticated={isAuthenticated}
          onVoiceOutput={onVoiceOutput}
          onTranslate={() => onTranslate(message.id)}
          onSimplify={() => onSimplify(message.id)}
          onSummarize={onSummarize}
          onShowOriginal={() => onShowOriginal(message.id)}
          onWordClick={onWordClick}
        />
      ))}
      <div ref={messagesEndRef} />
    </>
  );
}
