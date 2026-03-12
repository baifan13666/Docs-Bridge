'use client';

import { useTranslations } from 'next-intl';

interface PipelineStep {
  id: number;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'skipped';
  result?: string;
}

interface PipelineProgressProps {
  steps: PipelineStep[];
  show: boolean;
}

export default function PipelineProgress({ steps, show }: PipelineProgressProps) {
  const t = useTranslations();

  if (!show) return null;

  return (
    <div className="bg-(--color-bg-secondary) border border-(--color-border) rounded-lg p-4 shadow-sm animate-fadeIn">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 flex items-center justify-center shrink-0">
          <img src="/notextlogo.png" alt="DocsBridge" className="w-full h-full object-contain" />
        </div>
        <h4 className="text-sm font-semibold text-(--color-text-primary)">DocsBridge AI</h4>
      </div>
      <div className="space-y-2">
        {steps && steps.map((step) => (
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
  );
}
