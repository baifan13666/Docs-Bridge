'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Block } from './BlockEditor';

interface CodeBlockProps {
  block: Block;
  readOnly: boolean;
  focused: boolean;
  onFocus: () => void;
  onChange: (content: any) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  showMoveUp: boolean;
  showMoveDown: boolean;
}

const languages = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'csharp',
  'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
  'html', 'css', 'sql', 'bash', 'json', 'yaml', 'markdown'
];

export default function CodeBlock({
  block,
  readOnly,
  focused,
  onFocus,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  showMoveUp,
  showMoveDown
}: CodeBlockProps) {
  const t = useTranslations();
  const [copied, setCopied] = useState(false);

  const language = block.content?.language || 'javascript';
  const code = block.content?.code || '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative" onClick={onFocus}>
      <div className="bg-(--color-bg-secondary) border border-(--color-border) rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-(--color-border)">
          <select
            value={language}
            onChange={(e) => onChange({ ...block.content, language: e.target.value })}
            disabled={readOnly}
            className="text-sm bg-transparent text-(--color-text-secondary) outline-none cursor-pointer"
          >
            {languages.map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
          
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-(--color-bg-tertiary) rounded transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">
              {copied ? 'check' : 'content_copy'}
            </span>
            {copied ? t('common.copied') : t('common.copy')}
          </button>
        </div>

        {/* Code Editor */}
        <textarea
          value={code}
          onChange={(e) => onChange({ ...block.content, code: e.target.value })}
          disabled={readOnly}
          placeholder={t('knowledgeBase.blocks.codePlaceholder')}
          className="w-full px-4 py-3 bg-transparent text-(--color-text-primary) font-mono text-sm outline-none resize-none"
          style={{ minHeight: '120px' }}
          spellCheck={false}
        />
      </div>

      {/* Block Actions */}
      {focused && !readOnly && (
        <div className="absolute -left-12 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={onMoveUp} disabled={!showMoveUp} className="p-1 hover:bg-(--color-bg-tertiary) rounded cursor-pointer disabled:opacity-30">
            <span className="material-symbols-outlined text-sm">arrow_upward</span>
          </button>
          <button onClick={onMoveDown} disabled={!showMoveDown} className="p-1 hover:bg-(--color-bg-tertiary) rounded cursor-pointer disabled:opacity-30">
            <span className="material-symbols-outlined text-sm">arrow_downward</span>
          </button>
          <button onClick={onDelete} className="p-1 hover:bg-red-500/10 rounded cursor-pointer">
            <span className="material-symbols-outlined text-sm text-red-500">delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
