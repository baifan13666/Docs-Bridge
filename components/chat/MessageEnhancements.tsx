'use client';

import { useTranslations } from 'next-intl';
import * as nlpApi from '@/lib/api/nlp';

interface MessageEnhancementsProps {
  messageId: string;
  messageView: 'original' | 'simplified' | 'translated';
  simplified?: nlpApi.SimplificationResult;
  summary?: nlpApi.SummarizationResult;
  translations?: { [key: string]: nlpApi.TranslationResult };
}

export default function MessageEnhancements({
  messageId,
  messageView,
  simplified,
  summary,
  translations
}: MessageEnhancementsProps) {
  const t = useTranslations('chatInterface');

  return (
    <>
      {/* Readability score for simplified view with comparison */}
      {messageView === 'simplified' && simplified?.readability_score && (
        <div className="mt-3 p-2 bg-(--color-bg-secondary) rounded-lg border border-(--color-border)">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-lg">📊</span>
            <div className="flex-1">
              <div className="font-semibold text-(--color-text-primary)">
                {t('readabilityGrade', { grade: simplified.readability_score.simplified.toFixed(1) })}
              </div>
              <div className="text-(--color-text-secondary) mt-0.5">
                {t('originalGrade', { grade: simplified.readability_score.original.toFixed(1) })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-green-600 dark:text-green-400 font-semibold">
                {(() => {
                  const original = simplified.readability_score.original;
                  const simplifiedScore = simplified.readability_score.simplified;
                  const improvement = ((original - simplifiedScore) / original * 100);
                  return improvement > 0 ? t('percentEasier', { percent: improvement.toFixed(0) }) : t('simplified');
                })()}
              </div>
            </div>
          </div>
          {simplified.difficult_words.length > 0 && (
            <div className="mt-2 pt-2 border-t border-(--color-border) text-[11px] text-(--color-text-secondary)">
              {t('hoverTip')}
            </div>
          )}
        </div>
      )}
      
      {/* Translation confidence display */}
      {messageView === 'translated' && translations && (
        <div className="mt-3 p-2 bg-(--color-bg-secondary) rounded-lg border border-(--color-border)">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-lg">🌐</span>
            <div className="flex-1">
              <div className="font-semibold text-(--color-text-primary)">
                {t('translationQuality')}
              </div>
              {(() => {
                const translationKey = Object.keys(translations)[0];
                const translation = translations[translationKey];
                const confidence = translation?.confidence || 0;
                
                return (
                  <>
                    <div className="text-(--color-text-secondary) mt-0.5">
                      {t('confidence', { percent: (confidence * 100).toFixed(0) })}
                    </div>
                    {confidence < 0.8 && (
                      <div className="mt-1 text-orange-600 dark:text-orange-400 text-[11px]">
                        {t('lowConfidenceWarning')}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="text-right">
              {(() => {
                const translationKey = Object.keys(translations)[0];
                const translation = translations[translationKey];
                const confidence = translation?.confidence || 0;
                
                if (confidence >= 0.9) {
                  return <span className="text-green-600 dark:text-green-400 font-semibold">{t('highConfidence')}</span>;
                } else if (confidence >= 0.7) {
                  return <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{t('mediumConfidence')}</span>;
                } else {
                  return <span className="text-orange-600 dark:text-orange-400 font-semibold">{t('lowConfidence')}</span>;
                }
              })()}
            </div>
          </div>
        </div>
      )}
      
      {/* Summarization display (when summary exists) */}
      {summary && (
        <div className="mt-4 pt-4 border-t border-(--color-border)">
          <div className="space-y-3">
            {/* TL;DR format - show paragraph summary */}
            {summary.tldr && (
              <div>
                <p className="text-xs font-semibold text-(--color-text-secondary) mb-2">TL;DR</p>
                <p className="text-sm text-(--color-text-primary) leading-relaxed">
                  {summary.tldr}
                </p>
              </div>
            )}
            
            {/* Bullet points format */}
            {summary.bullet_points && summary.bullet_points.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-(--color-text-secondary) mb-2">{t('keyPoints')}</p>
                <ul className="list-disc list-inside space-y-1">
                  {summary.bullet_points.map((point, idx) => (
                    <li key={idx} className="text-xs text-(--color-text-primary)">{point}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {summary.key_actions && summary.key_actions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-(--color-text-secondary) mb-2">{t('actionsToTake')}</p>
                <ol className="list-decimal list-inside space-y-1">
                  {summary.key_actions.map((action, idx) => (
                    <li key={idx} className="text-xs text-(--color-text-primary)">{action}</li>
                  ))}
                </ol>
              </div>
            )}
            
            <p className="text-[11px] text-(--color-text-secondary)">
              {t('reducedWords', { 
                original: summary.word_count.original,
                summary: summary.word_count.summary,
                reduction: summary.word_count.reduction
              })}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
