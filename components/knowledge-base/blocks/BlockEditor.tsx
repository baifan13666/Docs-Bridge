'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import TextBlock from './TextBlock';
import ImageBlock from './ImageBlock';
import CodeBlock from './CodeBlock';
import EmbedBlock from './EmbedBlock';
import FileBlock from './FileBlock';
import DividerBlock from './DividerBlock';
import CanvasBlock from './CanvasBlock';
import TableBlock from './TableBlock';
import CalloutBlock from './CalloutBlock';
import ToggleBlock from './ToggleBlock';

export type BlockType = 
  | 'text' 
  | 'heading1' 
  | 'heading2' 
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'checkbox'
  | 'quote'
  | 'code'
  | 'image'
  | 'file'
  | 'embed'
  | 'divider'
  | 'canvas'
  | 'table'
  | 'callout'
  | 'toggle';

export interface Block {
  id: string;
  type: BlockType;
  content: any;
  metadata?: Record<string, any>;
}

interface BlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  readOnly?: boolean;
}

export default function BlockEditor({ blocks, onChange, readOnly = false }: BlockEditorProps) {
  const t = useTranslations();
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [blockMenuPosition, setBlockMenuPosition] = useState({ x: 0, y: 0 });

  const addBlock = useCallback((type: BlockType, afterBlockId?: string) => {
    const newBlock: Block = {
      id: `block-${Date.now()}-${Math.random()}`,
      type,
      content: type === 'divider' ? null : '',
      metadata: {}
    };

    if (afterBlockId) {
      const index = blocks.findIndex(b => b.id === afterBlockId);
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, newBlock);
      onChange(newBlocks);
    } else {
      onChange([...blocks, newBlock]);
    }

    setFocusedBlockId(newBlock.id);
    setShowBlockMenu(false);
  }, [blocks, onChange]);

  const updateBlock = useCallback((blockId: string, updates: Partial<Block>) => {
    onChange(blocks.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));
  }, [blocks, onChange]);

  const deleteBlock = useCallback((blockId: string) => {
    const newBlocks = blocks.filter(b => b.id !== blockId);
    onChange(newBlocks.length > 0 ? newBlocks : [
      { id: `block-${Date.now()}`, type: 'text', content: '' }
    ]);
  }, [blocks, onChange]);

  const moveBlock = useCallback((blockId: string, direction: 'up' | 'down') => {
    const index = blocks.findIndex(b => b.id === blockId);
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === blocks.length - 1)
    ) {
      return;
    }

    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    onChange(newBlocks);
  }, [blocks, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, blockId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const block = blocks.find(b => b.id === blockId);
      if (block && block.type !== 'code') {
        addBlock('text', blockId);
      }
    } else if (e.key === 'Backspace') {
      const block = blocks.find(b => b.id === blockId);
      if (block && !block.content && blocks.length > 1) {
        e.preventDefault();
        deleteBlock(blockId);
      }
    } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      const block = blocks.find(b => b.id === blockId);
      if (block && !block.content) {
        e.preventDefault();
        setShowBlockMenu(true);
        // Position menu near the block
        const element = e.currentTarget as HTMLElement;
        const rect = element.getBoundingClientRect();
        setBlockMenuPosition({ x: rect.left, y: rect.bottom });
      }
    }
  }, [blocks, addBlock, deleteBlock]);

  const renderBlock = (block: Block, index: number) => {
    const commonProps = {
      block,
      readOnly,
      focused: focusedBlockId === block.id,
      onFocus: () => setFocusedBlockId(block.id),
      onBlur: () => setFocusedBlockId(null),
      onChange: (content: any) => updateBlock(block.id, { content }),
      onDelete: () => deleteBlock(block.id),
      onMoveUp: () => moveBlock(block.id, 'up'),
      onMoveDown: () => moveBlock(block.id, 'down'),
      onKeyDown: (e: React.KeyboardEvent) => handleKeyDown(e, block.id),
      showMoveUp: index > 0,
      showMoveDown: index < blocks.length - 1
    };

    switch (block.type) {
      case 'image':
        return <ImageBlock key={block.id} {...commonProps} />;
      case 'code':
        return <CodeBlock key={block.id} {...commonProps} />;
      case 'embed':
        return <EmbedBlock key={block.id} {...commonProps} />;
      case 'file':
        return <FileBlock key={block.id} {...commonProps} />;
      case 'divider':
        return <DividerBlock key={block.id} {...commonProps} />;
      case 'canvas':
        return <CanvasBlock key={block.id} {...commonProps} />;
      case 'table':
        return <TableBlock key={block.id} {...commonProps} />;
      case 'callout':
        return <CalloutBlock key={block.id} {...commonProps} />;
      case 'toggle':
        return <ToggleBlock key={block.id} {...commonProps} />;
      default:
        return <TextBlock key={block.id} {...commonProps} />;
    }
  };

  return (
    <div className="space-y-1">
      {blocks.map((block, index) => renderBlock(block, index))}
      
      {!readOnly && (
        <button
          onClick={() => addBlock('text')}
          className="w-full py-3 text-left text-sm text-(--color-text-tertiary) hover:text-(--color-text-secondary) hover:bg-(--color-bg-secondary) rounded-lg transition-all duration-200 px-4 cursor-pointer"
        >
          <span className="material-symbols-outlined text-base mr-2 align-middle">add</span>
          {t('knowledgeBase.addBlock')}
        </button>
      )}

      {/* Block Type Menu */}
      {showBlockMenu && (
        <BlockTypeMenu
          onSelect={(type) => addBlock(type)}
          onClose={() => setShowBlockMenu(false)}
          position={blockMenuPosition}
        />
      )}
    </div>
  );
}

interface BlockTypeMenuProps {
  onSelect: (type: BlockType) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

function BlockTypeMenu({ onSelect, onClose, position }: BlockTypeMenuProps) {
  const t = useTranslations();
  
  const blockTypes: { type: BlockType; icon: string; label: string }[] = [
    { type: 'text', icon: 'text_fields', label: t('knowledgeBase.blocks.text') },
    { type: 'heading1', icon: 'title', label: t('knowledgeBase.blocks.heading1') },
    { type: 'heading2', icon: 'title', label: t('knowledgeBase.blocks.heading2') },
    { type: 'heading3', icon: 'title', label: t('knowledgeBase.blocks.heading3') },
    { type: 'bulletList', icon: 'format_list_bulleted', label: t('knowledgeBase.blocks.bulletList') },
    { type: 'numberedList', icon: 'format_list_numbered', label: t('knowledgeBase.blocks.numberedList') },
    { type: 'checkbox', icon: 'check_box', label: t('knowledgeBase.blocks.checkbox') },
    { type: 'quote', icon: 'format_quote', label: t('knowledgeBase.blocks.quote') },
    { type: 'code', icon: 'code', label: t('knowledgeBase.blocks.code') },
    { type: 'divider', icon: 'horizontal_rule', label: t('knowledgeBase.blocks.divider') },
    { type: 'callout', icon: 'info', label: t('knowledgeBase.blocks.callout') },
    { type: 'toggle', icon: 'expand_more', label: t('knowledgeBase.blocks.toggle') },
    { type: 'table', icon: 'table', label: t('knowledgeBase.blocks.table') },
    { type: 'image', icon: 'image', label: t('knowledgeBase.blocks.image') },
    { type: 'file', icon: 'attach_file', label: t('knowledgeBase.blocks.file') },
    { type: 'embed', icon: 'code_blocks', label: t('knowledgeBase.blocks.embed') },
    { type: 'canvas', icon: 'slideshow', label: t('knowledgeBase.blocks.canvas') }
  ];

  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      <div
        className="fixed z-50 bg-(--color-bg-secondary) border border-(--color-border) rounded-xl shadow-2xl p-2 w-64 max-h-96 overflow-y-auto"
        style={{ left: position.x, top: position.y }}
      >
        {blockTypes.map(({ type, icon, label }) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-(--color-bg-tertiary) rounded-lg transition-all duration-150 cursor-pointer text-left"
          >
            <span className="material-symbols-outlined text-lg text-(--color-text-secondary)">{icon}</span>
            <span className="text-sm text-(--color-text-primary)">{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
