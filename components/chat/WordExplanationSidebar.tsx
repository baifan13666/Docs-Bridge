'use client';

import { useTranslations } from 'next-intl';

interface WordExplanationSidebarProps {
  show: boolean;
  selectedWord: string | null;
  wordContext: string;
  wordExplanation: string | null;
  loadingExplanation: boolean;
  onClose: () => void;
}

export default function WordExplanationSidebar({
  show,
  selectedWord,
  wordContext,
  wordExplanation,
  loadingExplanation,
  onClose
}: WordExplanationSidebarProps) {
  const t = useTranslations('chatInterface');
  
  if (!show) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-(--color-bg-primary) border-l border-(--color-border) shadow-2xl z-50 overflow-y-auto animate-slideInRight">
        {/* Header */}
        <div className="sticky top-0 bg-(--color-bg-primary) border-b border-(--color-border) p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-(--color-text-primary)">
            {t('wordExplanation')}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-bg-secondary) rounded-lg transition-colors"
            aria-label={t('closeExplanation')}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Selected Word */}
          {selectedWord && (
            <div>
              <h4 className="text-2xl font-bold text-(--color-accent) mb-2">
                {selectedWord}
              </h4>
              <p className="text-sm text-(--color-text-secondary) italic">
                {t('clickUnderlinedWord')}
              </p>
            </div>
          )}

          {/* Loading State */}
          {loadingExplanation && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-12 h-12 border-4 border-(--color-accent) border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-(--color-text-secondary)">
                {t('gettingExplanation')}
              </p>
            </div>
          )}

          {/* Explanation */}
          {!loadingExplanation && wordExplanation && (
            <div className="space-y-4">
              <div className="p-4 bg-(--color-bg-secondary) rounded-lg border border-(--color-border)">
                <h5 className="text-sm font-semibold text-(--color-text-secondary) mb-2 uppercase tracking-wide">
                  {t('aiExplanation')}
                </h5>
                <div className="text-base text-(--color-text-primary) whitespace-pre-wrap leading-relaxed">
                  {wordExplanation}
                </div>
              </div>

              {/* Context */}
              {wordContext && (
                <div className="p-4 bg-(--color-bg-tertiary) rounded-lg border border-(--color-border)">
                  <h5 className="text-sm font-semibold text-(--color-text-secondary) mb-2 uppercase tracking-wide">
                    {t('context')}
                  </h5>
                  <p className="text-sm text-(--color-text-primary) leading-relaxed">
                    {wordContext.length > 200 
                      ? `...${wordContext.substring(wordContext.indexOf(selectedWord || '') - 50, wordContext.indexOf(selectedWord || '') + 150)}...`
                      : wordContext
                    }
                  </p>
                </div>
              )}

              {/* Tip */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <span className="text-blue-600 dark:text-blue-400 text-lg shrink-0">💡</span>
                <div className="flex-1">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {t('explanationTip')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
