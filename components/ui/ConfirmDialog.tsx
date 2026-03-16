'use client';

import { useTranslations } from 'next-intl';

interface ConfirmDialogProps {
  show: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmDialog({
  show,
  title,
  description,
  confirmText,
  cancelText,
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  loading = false
}: ConfirmDialogProps) {
  const t = useTranslations();

  if (!show) return null;

  const confirmButtonClass = confirmVariant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-(--color-accent) hover:bg-(--color-accent-hover) text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
      <div className="bg-(--color-bg-secondary) rounded-lg shadow-xl max-w-md w-full mx-4 border border-(--color-border)">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-(--color-text-primary) mb-2">
            {title}
          </h3>
          <p className="text-(--color-text-secondary) text-sm mb-6">
            {description}
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-(--color-border) text-(--color-text-primary) hover:bg-(--color-bg-tertiary) transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText || t('common.cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${confirmButtonClass}`}
            >
              {loading ? t('common.loading') : (confirmText || t('common.delete'))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
