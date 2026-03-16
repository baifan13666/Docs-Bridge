'use client';

import { useRef, useEffect } from 'react';
import type { Block } from './BlockEditor';

interface TextBlockProps {
  block: Block;
  readOnly: boolean;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (content: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  showMoveUp: boolean;
  showMoveDown: boolean;
}

export default function TextBlock({
  block,
  readOnly,
  focused,
  onFocus,
  onBlur,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onKeyDown,
  showMoveUp,
  showMoveDown
}: TextBlockProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current && focused) {
      contentRef.current.focus();
    }
  }, [focused]);

  const getClassName = () => {
    const base = 'outline-none px-4 py-2 rounded-lg transition-all duration-200';
    const hover = focused ? 'bg-(--color-bg-secondary)' : 'hover:bg-(--color-bg-secondary)';
    
    switch (block.type) {
      case 'heading1':
        return `${base} ${hover} text-3xl font-bold text-(--color-text-primary)`;
      case 'heading2':
        return `${base} ${hover} text-2xl font-bold text-(--color-text-primary)`;
      case 'heading3':
        return `${base} ${hover} text-xl font-semibold text-(--color-text-primary)`;
      case 'quote':
        return `${base} ${hover} border-l-4 border-(--color-accent) pl-6 italic text-(--color-text-secondary)`;
      case 'bulletList':
        return `${base} ${hover} list-disc list-inside text-(--color-text-primary)`;
      case 'numberedList':
        return `${base} ${hover} list-decimal list-inside text-(--color-text-primary)`;
      case 'checkbox':
        return `${base} ${hover} flex items-center gap-2 text-(--color-text-primary)`;
      default:
        return `${base} ${hover} text-(--color-text-primary)`;
    }
  };

  const renderContent = () => {
    if (block.type === 'checkbox') {
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={block.metadata?.checked || false}
            onChange={(e) => {
              onChange(block.content);
              // Update metadata
            }}
            disabled={readOnly}
            className="w-4 h-4 rounded border-2 border-(--color-border) cursor-pointer"
          />
          <div
            ref={contentRef}
            contentEditable={!readOnly}
            onInput={(e) => onChange(e.currentTarget.textContent || '')}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            className="flex-1 outline-none"
            suppressContentEditableWarning
          >
            {block.content}
          </div>
        </div>
      );
    }

    return (
      <div
        ref={contentRef}
        contentEditable={!readOnly}
        onInput={(e) => onChange(e.currentTarget.textContent || '')}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={getClassName()}
        data-placeholder={getPlaceholder()}
        suppressContentEditableWarning
      >
        {block.content}
      </div>
    );
  };

  const getPlaceholder = () => {
    switch (block.type) {
      case 'heading1': return 'Heading 1';
      case 'heading2': return 'Heading 2';
      case 'heading3': return 'Heading 3';
      case 'quote': return 'Quote';
      default: return "Type '/' for commands";
    }
  };

  return (
    <div className="group relative">
      {renderContent()}
      
      {/* Block Actions */}
      {focused && !readOnly && (
        <div className="absolute -left-12 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={onMoveUp}
            disabled={!showMoveUp}
            className="p-1 hover:bg-(--color-bg-tertiary) rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <span className="material-symbols-outlined text-sm text-(--color-text-secondary)">arrow_upward</span>
          </button>
          <button
            onClick={onMoveDown}
            disabled={!showMoveDown}
            className="p-1 hover:bg-(--color-bg-tertiary) rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <span className="material-symbols-outlined text-sm text-(--color-text-secondary)">arrow_downward</span>
          </button>
          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-500/10 rounded cursor-pointer"
            title="Delete"
          >
            <span className="material-symbols-outlined text-sm text-red-500">delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
