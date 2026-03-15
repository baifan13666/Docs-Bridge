'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Block } from './BlockEditor';

interface EmbedBlockProps {
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

export default function EmbedBlock({
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
}: EmbedBlockProps) {
  const t = useTranslations();
  const [urlInput, setUrlInput] = useState('');

  const embedUrl = block.content?.url || '';
  const embedType = block.content?.type || 'iframe';

  const handleSubmit = () => {
    if (urlInput.trim()) {
      const url = urlInput.trim();
      let type = 'iframe';
      let embedUrl = url;

      // YouTube
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        type = 'youtube';
        const videoId = url.includes('youtu.be') 
          ? url.split('youtu.be/')[1]?.split('?')[0]
          : url.split('v=')[1]?.split('&')[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}`;
      }
      // Vimeo
      else if (url.includes('vimeo.com')) {
        type = 'vimeo';
        const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
        embedUrl = `https://player.vimeo.com/video/${videoId}`;
      }
      // Google Slides
      else if (url.includes('docs.google.com/presentation')) {
        type = 'slides';
        embedUrl = url.replace('/edit', '/embed');
      }
      // Figma
      else if (url.includes('figma.com')) {
        type = 'figma';
        embedUrl = `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
      }

      onChange({ url: embedUrl, type, originalUrl: url });
      setUrlInput('');
    }
  };

  if (!embedUrl) {
    return (
      <div 
        className="group relative border-2 border-dashed border-(--color-border) rounded-xl p-8 hover:border-(--color-accent) transition-all duration-200"
        onClick={onFocus}
      >
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-(--color-text-tertiary) mb-4 block">
            code_blocks
          </span>
          <p className="text-sm text-(--color-text-secondary) mb-4">
            {t('knowledgeBase.blocks.embedContent')}
          </p>
          <p className="text-xs text-(--color-text-tertiary) mb-4">
            {t('knowledgeBase.blocks.embedSupports')}
          </p>
          
          {!readOnly && (
            <div className="flex items-center gap-2 max-w-md mx-auto">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder={t('knowledgeBase.blocks.embedUrlPlaceholder')}
                className="flex-1 px-3 py-2 text-sm bg-(--color-bg-secondary) border border-(--color-border) rounded-lg outline-none focus:border-(--color-accent)"
              />
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-(--color-accent) text-white rounded-lg hover:bg-(--color-accent-hover) transition-colors cursor-pointer text-sm"
              >
                {t('common.embed')}
              </button>
            </div>
          )}
        </div>

        {focused && !readOnly && (
          <button
            onClick={onDelete}
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
      <div className="rounded-xl overflow-hidden border border-(--color-border) bg-(--color-bg-secondary)">
        <div className="aspect-video w-full">
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        
        {block.content?.originalUrl && (
          <div className="px-4 py-2 text-xs text-(--color-text-tertiary) border-t border-(--color-border) flex items-center justify-between">
            <span className="truncate">{block.content.originalUrl}</span>
            <a
              href={block.content.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--color-accent) hover:underline ml-2 shrink-0"
            >
              {t('common.open')}
            </a>
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
