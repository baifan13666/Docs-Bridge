'use client';

import { useTranslations } from 'next-intl';

interface ConfidenceScore {
  overall: number;
  level: 'high' | 'medium' | 'low';
  explanation: string;
}

interface ConfidenceDisplayProps {
  confidence: ConfidenceScore;
}

export default function ConfidenceDisplay({ confidence }: ConfidenceDisplayProps) {
  const t = useTranslations('chatInterface');

  return (
    <div className="mt-3 pt-3 border-t border-(--color-border)">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">
          {confidence.level === 'high' ? '🟢' : 
           confidence.level === 'medium' ? '🟡' : '🔴'}
        </span>
        <span className="text-xs font-semibold text-(--color-text-secondary)">
          {t('confidenceLevel', { 
            percent: (confidence.overall * 100).toFixed(0),
            level: confidence.level
          })}
        </span>
      </div>
      <p className="text-[11px] text-(--color-text-secondary)">
        {confidence.explanation}
      </p>
    </div>
  );
}
