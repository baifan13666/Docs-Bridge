'use client';

import { useRef, useEffect } from 'react';
import type { Block } from './BlockEditor';

interface CalloutBlockProps {
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

type CalloutType = 'info' | 'warning' | 'error' | 'success' | 'tip';

const calloutStyles: Record<CalloutType, { bg: string; border: string; icon: string; iconColor: string }> = {
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: 'info',
    iconColor: 'text-blue-500'
  },
  warning: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: 'warning',
    iconColor: 'text-yellow-500'
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'error',
    iconColor: 'text-red-500'
  },
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    icon: 'check_circle',
    iconColor: 'text-green-500'
  },
  tip: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    icon: 'lightbulb',
    iconColor: 'text-purple-500'
  }
};

export default function CalloutBlock({
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
}: CalloutBlockProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const calloutType: CalloutType = block.content?.type || 'info';
  const text = block.content?.text || '';
  const style = calloutStyles[calloutType];

  useEffect(() => {
    if (contentRef.current && focused) {
      contentRef.current.focus();
    }
  }, [focused]);

  const handleTypeChange = (newType: CalloutType) => {
    onChange({ ...block.content, type: newType });
  };

  return (
    <div className="group relative" onClick={onFocus}>
      <div className={`${style.bg} ${style.border} border-2 rounded-xl p-4 flex gap-3`}>
        {/* Icon */}
        <div className="shrink-0">
          <span className={`material-symbols-outlined ${style.iconColor} text-2xl`}>
            {style.icon}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1">
          {!readOnly && (
            <select
              value={calloutType}
              onChange={(e) => handleTypeChange(e.target.value as CalloutType)}
              className="mb-2 text-xs bg-transparent border border-(--color-border) rounded px-2 py-1 outline-none cursor-pointer"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="success">Success</option>
              <option value="tip">Tip</option>
            </select>
          )}
          
          <div
            ref={contentRef}
            contentEditable={!readOnly}
            onInput={(e) => onChange({ ...block.content, text: e.currentTarget.textContent || '' })}
            onFocus={onFocus}
            className="outline-none text-(--color-text-primary) empty:before:content-['Type_something...'] empty:before:text-(--color-text-tertiary)"
            suppressContentEditableWarning
          >
            {text}
          </div>
        </div>
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
