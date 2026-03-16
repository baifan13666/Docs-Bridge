'use client';

import { useState, useRef, useEffect } from 'react';
import type { Block } from './BlockEditor';

interface ToggleBlockProps {
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

export default function ToggleBlock({
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
}: ToggleBlockProps) {
  const [isOpen, setIsOpen] = useState(block.content?.isOpen ?? false);
  const titleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const title = block.content?.title || '';
  const content = block.content?.content || '';

  useEffect(() => {
    if (focused && titleRef.current) {
      titleRef.current.focus();
    }
  }, [focused]);

  const handleToggle = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    onChange({ ...block.content, isOpen: newIsOpen });
  };

  return (
    <div className="group relative" onClick={onFocus}>
      <div className="bg-(--color-bg-secondary) border border-(--color-border) rounded-xl overflow-hidden">
        {/* Toggle Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-(--color-bg-tertiary) transition-colors"
          onClick={handleToggle}
        >
          <span className={`material-symbols-outlined text-(--color-text-secondary) transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
            chevron_right
          </span>
          <div
            ref={titleRef}
            contentEditable={!readOnly}
            onInput={(e) => onChange({ ...block.content, title: e.currentTarget.textContent || '' })}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 outline-none text-(--color-text-primary) font-medium empty:before:content-['Toggle_title...'] empty:before:text-(--color-text-tertiary)"
            suppressContentEditableWarning
          >
            {title}
          </div>
        </div>

        {/* Toggle Content */}
        {isOpen && (
          <div className="px-4 py-3 border-t border-(--color-border) animate-fadeIn">
            <div
              ref={contentRef}
              contentEditable={!readOnly}
              onInput={(e) => onChange({ ...block.content, content: e.currentTarget.textContent || '' })}
              className="outline-none text-(--color-text-primary) empty:before:content-['Toggle_content...'] empty:before:text-(--color-text-tertiary)"
              suppressContentEditableWarning
            >
              {content}
            </div>
          </div>
        )}
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
