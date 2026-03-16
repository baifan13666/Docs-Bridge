'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { Document } from './types';
import PerfectScrollbarWrapper from '../ui/PerfectScrollbar';
import BlockEditor, { Block } from './blocks/BlockEditor';
import * as kbApi from '@/lib/api/kb';
import { AttachmentSkeleton } from '../ui/Skeleton';
import { toast } from 'sonner';

interface EnhancedDocumentEditorProps {
  document: Document;
  onUpdate: (updates: Partial<Document>) => void;
}

const materialIcons = [
  'description', 'article', 'note', 'assignment', 'task', 'checklist', 
  'folder', 'folder_open', 'topic', 'book', 'menu_book', 'library_books',
  'rocket_launch', 'lightbulb', 'star', 'flag', 'bookmark', 'label',
  'code', 'terminal', 'bug_report', 'build', 'settings', 'dashboard',
  'analytics', 'bar_chart', 'pie_chart', 'trending_up', 'campaign', 'notifications'
];

export default function EnhancedDocumentEditor({ document, onUpdate }: EnhancedDocumentEditorProps) {
  const t = useTranslations();
  const [title, setTitle] = useState(document.title);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const isReadOnly = document.documentType === 'gov_crawled';

  // Update title when document changes
  useEffect(() => {
    setTitle(document.title);
  }, [document.id, document.title]);

  // Parse content into blocks on mount or when document changes
  useEffect(() => {
    try {
      const parsed = JSON.parse(document.content || '{}');
      
      if (parsed.blocks && Array.isArray(parsed.blocks)) {
        setBlocks(parsed.blocks);
      } else {
        // Legacy content - convert to single text block
        setBlocks([
          {
            id: `block-${Date.now()}`,
            type: 'text',
            content: document.content || ''
          }
        ]);
      }
    } catch (error) {
      // Invalid JSON - treat as plain text
      setBlocks([
        {
          id: `block-${Date.now()}`,
          type: 'text',
          content: document.content || ''
        }
      ]);
    }
  }, [document.id, document.content]);

  // Auto-save blocks
  useEffect(() => {
    if (blocks.length === 0) return;

    const timeoutId = setTimeout(() => {
      saveBlocks();
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [blocks]);

  const saveBlocks = async () => {
    if (isReadOnly) return;

    try {
      setSaving(true);
      const content = JSON.stringify({ blocks, version: 2 });
      await onUpdate({ content });
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving blocks:', error);
      toast.error(t('errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setTimeout(() => {
      onUpdate({ title: newTitle });
    }, 500);
  };

  const handleIconChange = (icon: string) => {
    onUpdate({ icon });
    setShowIconPicker(false);
  };

  const handleBlocksChange = useCallback((newBlocks: Block[]) => {
    setBlocks(newBlocks);
  }, []);

  return (
    <PerfectScrollbarWrapper className="flex-1">
      <div className="max-w-5xl mx-auto px-16 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-(--color-border)">
          <div
            onClick={() => !isReadOnly && setShowIconPicker(!showIconPicker)}
            className={`relative shrink-0 w-14 h-14 rounded-xl bg-(--color-accent)/10 border-2 border-(--color-accent)/20 flex items-center justify-center transition-all duration-200 ${
              isReadOnly ? 'opacity-60' : 'hover:bg-(--color-accent)/20 hover:border-(--color-accent)/40 cursor-pointer group'
            }`}
            title={isReadOnly ? t('knowledgeBase.readOnly') : t('knowledgeBase.changeIcon')}
          >
            <span className={`material-symbols-outlined text-4xl text-(--color-accent) transition-transform duration-200 ${
              isReadOnly ? '' : 'group-hover:scale-110'
            }`}>{document.icon}</span>
            {showIconPicker && !isReadOnly && (
              <div className="absolute top-full left-0 mt-2 p-3 bg-(--color-bg-secondary) border border-(--color-border) rounded-xl shadow-2xl z-20 grid grid-cols-8 gap-1.5 w-80">
                {materialIcons.map((icon) => (
                  <button
                    key={icon}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleIconChange(icon);
                    }}
                    className="w-9 h-9 flex items-center justify-center hover:bg-(--color-bg-tertiary) rounded-lg transition-all duration-150 cursor-pointer group"
                    title={icon}
                  >
                    <span className="material-symbols-outlined text-xl text-(--color-text-secondary) group-hover:text-(--color-accent) transition-colors duration-150">{icon}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              disabled={isReadOnly}
              className={`w-full text-3xl font-bold bg-transparent border-none outline-none text-(--color-text-primary) placeholder:text-(--color-text-tertiary) ${
                isReadOnly ? 'cursor-not-allowed opacity-80' : ''
              }`}
              placeholder={t('knowledgeBase.untitled')}
            />
            
            {/* Read-only badge for government documents */}
            {isReadOnly && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <span className="material-symbols-outlined text-blue-500 text-sm">lock</span>
                  <span className="text-xs font-medium text-blue-500">{t('knowledgeBase.governmentDocument')}</span>
                </div>
                <span className="text-xs text-(--color-text-tertiary)">{t('knowledgeBase.readOnly')}</span>
              </div>
            )}
            
            {/* Save Status */}
            {!isReadOnly && (
              <div className="flex items-center gap-2 mt-2 text-xs text-(--color-text-tertiary)">
                {saving ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                    <span>{t('common.saving')}</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span>{t('common.saved')} {lastSaved.toLocaleTimeString()}</span>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Block Editor */}
        <BlockEditor
          blocks={blocks}
          onChange={handleBlocksChange}
          readOnly={isReadOnly}
        />

        {/* Document Info */}
        <div className="mt-12 pt-8 border-t border-(--color-border) text-sm text-(--color-text-tertiary)">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>{blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}</span>
              {isReadOnly && (
                <span className="flex items-center gap-1 text-(--color-accent)">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  {t('knowledgeBase.readOnly')}
                </span>
              )}
            </div>
            <div>
              {t('knowledgeBase.lastEdited')}: {document.lastEdited.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </PerfectScrollbarWrapper>
  );
}
