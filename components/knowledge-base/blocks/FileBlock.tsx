'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Block } from './BlockEditor';

interface FileBlockProps {
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

export default function FileBlock({
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
}: FileBlockProps) {
  const t = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // TODO: Upload to storage and get URL
      onChange({
        name: file.name,
        size: file.size,
        type: file.type,
        url: '#' // Placeholder
      });
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return 'picture_as_pdf';
    if (type.includes('word') || type.includes('document')) return 'description';
    if (type.includes('sheet') || type.includes('excel')) return 'table_chart';
    if (type.includes('presentation') || type.includes('powerpoint')) return 'slideshow';
    if (type.includes('zip') || type.includes('rar')) return 'folder_zip';
    if (type.includes('text')) return 'article';
    return 'insert_drive_file';
  };

  if (!block.content?.name) {
    return (
      <div 
        className="group relative border-2 border-dashed border-(--color-border) rounded-xl p-8 hover:border-(--color-accent) transition-all duration-200 cursor-pointer"
        onClick={() => !readOnly && fileInputRef.current?.click()}
      >
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-(--color-text-tertiary) mb-4 block">
            {uploading ? 'hourglass_empty' : 'upload_file'}
          </span>
          <p className="text-sm text-(--color-text-secondary)">
            {uploading ? t('common.uploading') : t('knowledgeBase.blocks.uploadFile')}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
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
      <div className="flex items-center gap-4 p-4 bg-(--color-bg-secondary) border border-(--color-border) rounded-xl hover:border-(--color-accent) transition-all duration-200">
        <div className="shrink-0 w-12 h-12 bg-(--color-bg-tertiary) rounded-lg flex items-center justify-center">
          <span className="material-symbols-outlined text-(--color-accent) text-2xl">
            {getFileIcon(block.content.type)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-(--color-text-primary) truncate">
            {block.content.name}
          </p>
          <p className="text-sm text-(--color-text-secondary)">
            {formatBytes(block.content.size)}
          </p>
        </div>
        {block.content.url && block.content.url !== '#' && (
          <a
            href={block.content.url}
            download={block.content.name}
            className="p-2 hover:bg-(--color-bg-tertiary) rounded-lg transition-all duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="material-symbols-outlined text-lg text-(--color-accent)">download</span>
          </a>
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
