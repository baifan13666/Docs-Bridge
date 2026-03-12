'use client';

import { useTranslations } from 'next-intl';

interface MessageActionsProps {
  messageId: string;
  messageContent: string;
  messageView: 'original' | 'simplified' | 'translated';
  loadingStates?: {
    translating?: boolean;
    simplifying?: boolean;
    summarizingTldr?: boolean;
    summarizingBullets?: boolean;
  };
  detectedLanguage?: { language: string; dialect?: string };
  voiceOutputSupported: boolean;
  isSpeaking: boolean;
  missingVoiceWarning?: string;
  hasSimplified: boolean;
  hasDifficultWords: boolean;
  onVoiceOutput: (messageId: string, content: string) => void;
  onTranslate: (messageId: string) => void;
  onSimplify: (messageId: string) => void;
  onSummarize: (messageId: string, format: 'tldr' | 'bullet_points') => void;
  onShowOriginal: (messageId: string) => void;
}

export default function MessageActions({
  messageId,
  messageContent,
  messageView,
  loadingStates,
  detectedLanguage,
  voiceOutputSupported,
  isSpeaking,
  missingVoiceWarning,
  hasSimplified,
  hasDifficultWords,
  onVoiceOutput,
  onTranslate,
  onSimplify,
  onSummarize,
  onShowOriginal
}: MessageActionsProps) {
  const t = useTranslations('chatInterface');

  return (
    <>
      <div className="flex gap-2 mb-3 flex-wrap">
        {/* Voice output button */}
        {voiceOutputSupported && (
          <button
            onClick={() => onVoiceOutput(messageId, messageContent)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-(--color-bg-secondary) text-(--color-text-primary) rounded-full text-sm hover:bg-(--color-bg-tertiary) transition-colors border border-(--color-border) shadow-sm font-medium cursor-pointer"
          >
            <span className="material-symbols-outlined text-base text-(--color-accent)">
              {isSpeaking ? 'stop_circle' : 'volume_up'}
            </span>
            {isSpeaking ? t('stopPlaying') : t('playResponse')}
          </button>
        )}
        
        {/* Translate button */}
        {detectedLanguage?.dialect && (
          <button
            onClick={() => {
              if (messageView === 'translated') {
                onShowOriginal(messageId);
              } else {
                onTranslate(messageId);
              }
            }}
            disabled={loadingStates?.translating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-(--color-bg-secondary) text-(--color-text-primary) rounded-full text-sm hover:bg-(--color-bg-tertiary) transition-colors border border-(--color-border) shadow-sm font-medium cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base text-(--color-accent)">
              {loadingStates?.translating ? 'sync' : 'translate'}
            </span>
            {loadingStates?.translating 
              ? t('translating')
              : messageView === 'translated'
              ? t('showOriginal')
              : t('translateTo', { dialect: detectedLanguage.dialect })
            }
          </button>
        )}
        
        {/* Simplify button */}
        <button
          onClick={() => {
            if (messageView === 'simplified') {
              onShowOriginal(messageId);
            } else {
              onSimplify(messageId);
            }
          }}
          disabled={loadingStates?.simplifying}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-(--color-bg-secondary) text-(--color-text-primary) rounded-full text-sm hover:bg-(--color-bg-tertiary) transition-colors border border-(--color-border) shadow-sm font-medium cursor-pointer disabled:opacity-50"
          title={hasSimplified && !hasDifficultWords ? 'No difficult words found in this text' : ''}
        >
          <span className="material-symbols-outlined text-base text-(--color-accent)">
            {loadingStates?.simplifying ? 'sync' : messageView === 'simplified' ? 'description' : 'auto_awesome'}
          </span>
          {loadingStates?.simplifying 
            ? t('simplifying')
            : messageView === 'simplified'
            ? t('showOriginal')
            : t('simplifyProfessionalWords')
          }
        </button>
        
        {/* Summarize Overall button */}
        {messageContent.length > 500 && (
          <button
            onClick={() => onSummarize(messageId, 'tldr')}
            disabled={loadingStates?.summarizingTldr}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-(--color-bg-secondary) text-(--color-text-primary) rounded-full text-sm hover:bg-(--color-bg-tertiary) transition-colors border border-(--color-border) shadow-sm font-medium cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base text-(--color-accent)">
              {loadingStates?.summarizingTldr ? 'sync' : 'summarize'}
            </span>
            {loadingStates?.summarizingTldr ? t('summarizing') : t('summarizeOverall')}
          </button>
        )}
        
        {/* Summarize in Point Form button */}
        {messageContent.length > 500 && (
          <button
            onClick={() => onSummarize(messageId, 'bullet_points')}
            disabled={loadingStates?.summarizingBullets}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-(--color-bg-secondary) text-(--color-text-primary) rounded-full text-sm hover:bg-(--color-bg-tertiary) transition-colors border border-(--color-border) shadow-sm font-medium cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base text-(--color-accent)">
              {loadingStates?.summarizingBullets ? 'sync' : 'format_list_bulleted'}
            </span>
            {loadingStates?.summarizingBullets ? t('summarizing') : t('summarizeInPointForm')}
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
                {t('voiceWarningDescription')}
              </p>
              <details className="mt-2">
                <summary className="text-xs text-orange-600 dark:text-orange-400 cursor-pointer hover:underline">
                  {t('howToInstallVoicePacks')}
                </summary>
                <div className="mt-2 text-xs text-orange-600 dark:text-orange-400 space-y-1">
                  <p>{t('windowsInstructions')}</p>
                  <p>{t('macosInstructions')}</p>
                  <p>{t('mobileInstructions')}</p>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
