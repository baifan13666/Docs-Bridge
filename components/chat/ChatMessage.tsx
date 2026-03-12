'use client';

import { useTranslations } from 'next-intl';
import MarkdownContent from './MarkdownContent';
import DifficultWordsText from './DifficultWordsText';
import MessageActions from './MessageActions';
import MessageEnhancements from './MessageEnhancements';
import MessageSources from './MessageSources';
import ConfidenceDisplay from './ConfidenceDisplay';
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

interface ChatMessageProps {
  message: Message;
  isStreaming: boolean;
  messageView: 'original' | 'simplified' | 'translated';
  messageContent: string;
  messageEnhancements?: {
    simplified?: nlpApi.SimplificationResult;
    summary?: nlpApi.SummarizationResult;
    translations?: { [key: string]: nlpApi.TranslationResult };
  };
  loadingStates?: {
    simplifying?: boolean;
    summarizing?: boolean;
    summarizingTldr?: boolean;
    summarizingBullets?: boolean;
    translating?: boolean;
  };
  detectedLanguage?: {
    language: string;
    dialect?: string;
  };
  voiceOutputSupported: boolean;
  isSpeaking: boolean;
  missingVoiceWarning?: string;
  isAuthenticated: boolean;
  onVoiceOutput: (messageId: string, content: string) => void;
  onTranslate: (messageId: string) => void;
  onSimplify: (messageId: string) => void;
  onSummarize: (messageId: string, format: 'tldr' | 'bullet_points') => void;
  onShowOriginal: (messageId: string) => void;
  onWordClick: (word: string, context: string) => void;
}

export default function ChatMessage({
  message,
  isStreaming,
  messageView,
  messageContent,
  messageEnhancements,
  loadingStates,
  detectedLanguage,
  voiceOutputSupported,
  isSpeaking,
  missingVoiceWarning,
  isAuthenticated,
  onVoiceOutput,
  onTranslate,
  onSimplify,
  onSummarize,
  onShowOriginal,
  onWordClick
}: ChatMessageProps) {
  const t = useTranslations();

  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : message.role === 'system' ? 'justify-center' : 'justify-start'}`}>
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
            <MessageActions
              messageId={message.id}
              messageView={messageView}
              messageContent={messageContent}
              detectedLanguage={detectedLanguage}
              voiceOutputSupported={voiceOutputSupported}
              isSpeaking={isSpeaking}
              missingVoiceWarning={missingVoiceWarning}
              loadingStates={loadingStates}
              hasSimplified={!!messageEnhancements?.simplified}
              hasDifficultWords={!!messageEnhancements?.simplified?.difficult_words && messageEnhancements.simplified.difficult_words.length > 0}
              onVoiceOutput={onVoiceOutput}
              onTranslate={onTranslate}
              onSimplify={onSimplify}
              onSummarize={onSummarize}
              onShowOriginal={onShowOriginal}
            />
          )}
          
          {/* Message content with markdown rendering for AI, difficult words highlighting for simplified view */}
          {(() => {
            const isAssistant = message.role === 'assistant';
            const hasSimplified = messageEnhancements?.simplified;
            const hasDifficultWords = hasSimplified?.difficult_words && hasSimplified.difficult_words.length > 0;
            
            // For simplified view with difficult words, use DifficultWordsText
            if (isAssistant && messageView === 'simplified' && hasDifficultWords) {
              return (
                <DifficultWordsText
                  text={messageContent}
                  difficultWords={hasSimplified!.difficult_words}
                  className="whitespace-pre-wrap"
                  onWordClick={onWordClick}
                />
              );
            }
            
            // For assistant messages, render as markdown
            if (isAssistant) {
              return (
                <>
                  <MarkdownContent 
                    content={messageContent || (message.id.startsWith('streaming-') && isStreaming ? t('chatInterface.thinking') : '')}
                  />
                  {/* Streaming cursor */}
                  {message.id.startsWith('streaming-') && isStreaming && (
                    <span className="inline-block w-2 h-4 ml-1 bg-(--color-accent) animate-pulse"></span>
                  )}
                </>
              );
            }
            
            // For user messages, render as plain text
            return (
              <p className="whitespace-pre-wrap">
                {messageContent}
              </p>
            );
          })()}
          
          {/* Message enhancements (readability, translation quality, summary) */}
          {message.role === 'assistant' && messageEnhancements && (
            <MessageEnhancements
              messageId={message.id}
              messageView={messageView}
              simplified={messageEnhancements.simplified}
              summary={messageEnhancements.summary}
              translations={messageEnhancements.translations}
            />
          )}
          
          {/* Display confidence score if available */}
          {message.confidence && (
            <ConfidenceDisplay confidence={message.confidence} />
          )}

          {/* Display sources if available */}
          {message.sources && message.sources.length > 0 && (
            <MessageSources 
              sources={message.sources}
              isAuthenticated={isAuthenticated}
            />
          )}
        </div>
      </div>
    </div>
  );
}
