'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Block } from './BlockEditor';
import Image from 'next/image';

interface ImageBlockProps {
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

export default function ImageBlock({
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
}: ImageBlockProps) {
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // TODO: Upload to storage and get URL
      const reader = new FileReader();
      reader.onload = (e) => {
        onChange({
          url: e.target?.result as string,
          alt: file.name,
          caption: ''
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange({
        url: urlInput.trim(),
        alt: 'Image',
        caption: ''
      });
      setUrlInput('');
    }
  };

  if (!block.content?.url) {
    return (
      <div 
        className="group relative border-2 border-dashed border-(--color-border) rounded-xl p-8 hover:border-(--color-accent) transition-all duration-200 cursor-pointer"
        onClick={() => !readOnly && fileInputRef.current?.click()}
      >
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-(--color-text-tertiary) mb-4 block">
            {uploading ? 'hourglass_empty' : 'add_photo_alternate'}
          </span>
          <p className="text-sm text-(--color-text-secondary) mb-4">
            {uploading ? t('common.uploading') : t('knowledgeBase.blocks.uploadImage')}
          </p>
          
          {!uploading && !readOnly && (
            <div className="flex items-center gap-2 max-w-md mx-auto">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                placeholder={t('knowledgeBase.blocks.imageUrlPlaceholder')}
                className="flex-1 px-3 py-2 text-sm bg-(--color-bg-secondary) border border-(--color-border) rounded-lg outline-none focus:border-(--color-accent)"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUrlSubmit();
                }}
                className="px-4 py-2 bg-(--color-accent) text-white rounded-lg hover:bg-(--color-accent-hover) transition-colors cursor-pointer text-sm"
              >
                {t('common.add')}
              </button>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          disabled={readOnly}
        />

        {focused && !readOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="group relative" onClick={onFocus}>
      <div className="rounded-xl overflow-hidden border border-(--color-border)">
        <div className="relative w-full" style={{ minHeight: '200px' }}>
          <Image
            src={block.content.url}
            alt={block.content.alt || 'Image'}
            width={800}
            height={600}
            className="w-full h-auto object-contain"
            unoptimized={block.content.url.startsWith('data:')}
          />
        </div>
        
        {!readOnly && (
          <input
            type="text"
            value={block.content.caption || ''}
            onChange={(e) => onChange({ ...block.content, caption: e.target.value })}
            placeholder={t('knowledgeBase.blocks.addCaption')}
            className="w-full px-4 py-2 text-sm bg-(--color-bg-secondary) border-t border-(--color-border) outline-none focus:bg-(--color-bg-tertiary)"
          />
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
