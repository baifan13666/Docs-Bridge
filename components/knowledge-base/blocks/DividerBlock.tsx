'use client';

import type { Block } from './BlockEditor';

interface DividerBlockProps {
  block: Block;
  readOnly: boolean;
  focused: boolean;
  onFocus: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  showMoveUp: boolean;
  showMoveDown: boolean;
}

export default function DividerBlock({
  focused,
  onFocus,
  onDelete,
  onMoveUp,
  onMoveDown,
  showMoveUp,
  showMoveDown,
  readOnly
}: DividerBlockProps) {
  return (
    <div className="group relative py-4" onClick={onFocus}>
      <hr className="border-t-2 border-(--color-border)" />

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
