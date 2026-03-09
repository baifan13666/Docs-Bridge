'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { Document } from './types';
import PerfectScrollbarWrapper from '../ui/PerfectScrollbar';
import * as kbApi from '@/lib/api/kb';
import { AttachmentSkeleton } from '../ui/Skeleton';
import { toast } from 'sonner';

interface DocumentEditorProps {
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

export default function DocumentEditor({ document, onUpdate }: DocumentEditorProps) {
  const t = useTranslations();
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content || '');
  const [attachments, setAttachments] = useState<kbApi.KBAttachment[]>([]);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const titleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if document is read-only (government documents)
  const isReadOnly = document.documentType === 'gov_crawled';

  // Load attachments when document changes
  useEffect(() => {
    loadAttachments();
  }, [document.id]);

  async function loadAttachments() {
    try {
      setLoadingAttachments(true);
      const fetchedAttachments = await kbApi.fetchAttachments(document.id);
      setAttachments(fetchedAttachments);
    } catch (error) {
      console.error('Error loading attachments:', error);
    } finally {
      setLoadingAttachments(false);
    }
  }

  // Update local state when document prop changes
  useEffect(() => {
    setTitle(document.title);
    setContent(document.content || '');
    
    // Update contentEditable div only when document changes
    if (contentRef.current && document.content !== undefined) {
      const currentContent = contentRef.current.innerHTML;
      if (currentContent !== document.content) {
        contentRef.current.innerHTML = document.content || '';
      }
    }
  }, [document.id, document.title, document.content]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (titleTimeoutRef.current) {
        clearTimeout(titleTimeoutRef.current);
      }
      if (contentTimeoutRef.current) {
        clearTimeout(contentTimeoutRef.current);
      }
    };
  }, []);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    
    // Clear existing timeout
    if (titleTimeoutRef.current) {
      clearTimeout(titleTimeoutRef.current);
    }
    
    // Debounce API call by 500ms
    titleTimeoutRef.current = setTimeout(() => {
      onUpdate({ title: newTitle });
    }, 500);
  };

  const handleContentChange = () => {
    if (contentRef.current) {
      const newContent = contentRef.current.innerHTML;
      setContent(newContent);
      
      // Clear existing timeout
      if (contentTimeoutRef.current) {
        clearTimeout(contentTimeoutRef.current);
      }
      
      // Debounce API call by 1000ms for content (longer since it changes more frequently)
      contentTimeoutRef.current = setTimeout(() => {
        onUpdate({ content: newContent });
      }, 1000);
    }
  };

  const handleIconChange = (icon: string) => {
    onUpdate({ icon });
    setShowIconPicker(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      // Upload files one by one
      for (const file of Array.from(files)) {
        const newAttachment = await kbApi.uploadAttachment(document.id, file);
        setAttachments(prev => [...prev, newAttachment]);
      }
    } catch (error: any) {
      console.error('Error uploading files:', error);
      toast.error(t('errors.uploadFileFailed'), {
        description: error.message
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = async (id: string) => {
    try {
      await kbApi.deleteAttachment(id);
      setAttachments(prev => prev.filter(att => att.id !== id));
    } catch (error: any) {
      console.error('Error deleting attachment:', error);
      toast.error(t('errors.deleteAttachmentFailed'), {
        description: error.message
      });
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
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'videocam';
    if (type.startsWith('audio/')) return 'audio_file';
    if (type.includes('pdf')) return 'picture_as_pdf';
    if (type.includes('word') || type.includes('document')) return 'description';
    if (type.includes('sheet') || type.includes('excel')) return 'table_chart';
    if (type.includes('presentation') || type.includes('powerpoint')) return 'slideshow';
    if (type.includes('zip') || type.includes('rar')) return 'folder_zip';
    if (type.includes('text')) return 'article';
    return 'insert_drive_file';
  };

  const applyFormat = (command: string, value?: string) => {
    // Ensure we're in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    
    // Ensure content is focused
    if (!contentRef.current) return;
    
    contentRef.current.focus();
    
    try {
      // For list commands, use direct DOM manipulation
      if (command === 'insertUnorderedList' || command === 'insertOrderedList') {
        insertList(command === 'insertUnorderedList' ? 'ul' : 'ol');
      } else {
        // For other formatting commands, try execCommand if available
        if ('execCommand' in document) {
          // @ts-ignore
          document.execCommand(command, false, value);
        }
      }
      
      contentRef.current.focus();
    } catch (error) {
      console.error('Error applying format:', error);
    }
    
    // Keep toolbar visible after formatting
    setShowToolbar(true);
  };

  const insertList = (listType: 'ul' | 'ol') => {
    // Extra safety check
    if (typeof window === 'undefined' || !window.document) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    
    // Get selected text or use default
    let selectedText = range.toString().trim();
    if (!selectedText) {
      // If no selection, try to get the current line
      const container = range.startContainer;
      if (container.nodeType === Node.TEXT_NODE && container.textContent) {
        selectedText = container.textContent.trim();
      } else {
        selectedText = 'List item';
      }
    }
    
    // Create the list using window.document
    const list = window.document.createElement(listType);
    const listItem = window.document.createElement('li');
    listItem.textContent = selectedText;
    list.appendChild(listItem);
    
    // Delete the selected content
    range.deleteContents();
    
    // Insert the list
    range.insertNode(list);
    
    // Move cursor to end of list item
    const newRange = window.document.createRange();
    newRange.selectNodeContents(listItem);
    newRange.collapse(false);
    selection.removeAllRanges();
    selection.addRange(newRange);
  };

  return (
    <PerfectScrollbarWrapper className="flex-1">
      <div className="max-w-4xl mx-auto px-16 py-8">
        {/* Icon and Title - Compact inline design */}
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
          
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            disabled={isReadOnly}
            className={`flex-1 text-3xl font-bold bg-transparent border-none outline-none text-(--color-text-primary) placeholder:text-(--color-text-tertiary) ${
              isReadOnly ? 'cursor-not-allowed opacity-80' : ''
            }`}
            placeholder={t('knowledgeBase.untitled')}
          />
        </div>

        {/* Floating Toolbar */}
        {!isReadOnly && (
          <div 
            className={`sticky top-0 bg-(--color-bg-primary)/95 backdrop-blur-sm z-10 py-3 mb-6 transition-all duration-200 ${
              showToolbar ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onMouseDown={(e) => {
              // Prevent toolbar clicks from causing editor to lose focus
              e.preventDefault();
            }}
          >
          <div className="flex items-center gap-0.5 p-1.5 bg-(--color-bg-secondary) border border-(--color-border) rounded-lg shadow-lg w-fit">
            <button
              onClick={() => applyFormat('bold')}
              className="p-2 hover:bg-(--color-bg-tertiary) rounded-md transition-all duration-150 cursor-pointer group"
              title={t('knowledgeBase.toolbar.bold')}
            >
              <span className="material-symbols-outlined text-lg text-(--color-text-secondary) group-hover:text-(--color-text-primary)">format_bold</span>
            </button>
            <button
              onClick={() => applyFormat('italic')}
              className="p-2 hover:bg-(--color-bg-tertiary) rounded-md transition-all duration-150 cursor-pointer group"
              title={t('knowledgeBase.toolbar.italic')}
            >
              <span className="material-symbols-outlined text-lg text-(--color-text-secondary) group-hover:text-(--color-text-primary)">format_italic</span>
            </button>
            <button
              onClick={() => applyFormat('underline')}
              className="p-2 hover:bg-(--color-bg-tertiary) rounded-md transition-all duration-150 cursor-pointer group"
              title={t('knowledgeBase.toolbar.underline')}
            >
              <span className="material-symbols-outlined text-lg text-(--color-text-secondary) group-hover:text-(--color-text-primary)">format_underlined</span>
            </button>
            <button
              onClick={() => applyFormat('strikeThrough')}
              className="p-2 hover:bg-(--color-bg-tertiary) rounded-md transition-all duration-150 cursor-pointer group"
              title={t('knowledgeBase.toolbar.strikethrough')}
            >
              <span className="material-symbols-outlined text-lg text-(--color-text-secondary) group-hover:text-(--color-text-primary)">strikethrough_s</span>
            </button>
            
            <div className="w-px h-5 bg-(--color-border) mx-1"></div>
            
            <button
              onClick={() => applyFormat('formatBlock', '<h1>')}
              className="px-2.5 py-1.5 hover:bg-(--color-bg-tertiary) rounded-md transition-all duration-150 text-sm font-semibold cursor-pointer text-(--color-text-secondary) group-hover:text-(--color-text-primary)"
              title={t('knowledgeBase.toolbar.heading1')}
            >
              H1
            </button>
            <button
              onClick={() => applyFormat('formatBlock', '<h2>')}
              className="px-2.5 py-1.5 hover:bg-(--color-bg-tertiary) rounded-md transition-all duration-150 text-sm font-semibold cursor-pointer text-(--color-text-secondary) group-hover:text-(--color-text-primary)"
              title={t('knowledgeBase.toolbar.heading2')}
            >
              H2
            </button>
            <button
              onClick={() => applyFormat('formatBlock', '<h3>')}
              className="px-2.5 py-1.5 hover:bg-(--color-bg-tertiary) rounded-md transition-all duration-150 text-sm font-semibold cursor-pointer text-(--color-text-secondary) group-hover:text-(--color-text-primary)"
              title={t('knowledgeBase.toolbar.heading3')}
            >
              H3
            </button>
            
            <div className="w-px h-5 bg-(--color-border) mx-1"></div>
            
            <button
              onClick={() => applyFormat('insertUnorderedList')}
              className="p-2 hover:bg-(--color-bg-tertiary) rounded-md transition-all duration-150 cursor-pointer group"
              title={t('knowledgeBase.toolbar.bulletList')}
            >
              <span className="material-symbols-outlined text-lg text-(--color-text-secondary) group-hover:text-(--color-text-primary)">format_list_bulleted</span>
            </button>
            <button
              onClick={() => applyFormat('insertOrderedList')}
              className="p-2 hover:bg-(--color-bg-tertiary) rounded-md transition-all duration-150 cursor-pointer group"
              title={t('knowledgeBase.toolbar.numberedList')}
            >
              <span className="material-symbols-outlined text-lg text-(--color-text-secondary) group-hover:text-(--color-text-primary)">format_list_numbered</span>
            </button>
            
            <div className="w-px h-5 bg-(--color-border) mx-1"></div>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2 hover:bg-(--color-bg-tertiary) rounded-md transition-all duration-150 cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
              title={t('knowledgeBase.uploadFile')}
            >
              <span className="material-symbols-outlined text-lg text-(--color-text-secondary) group-hover:text-(--color-text-primary)">
                {uploading ? 'hourglass_empty' : 'attach_file'}
              </span>
            </button>
          </div>
        </div>
        )}

        {/* Content Editor */}
        <div
          ref={contentRef}
          contentEditable={!isReadOnly}
          onInput={handleContentChange}
          onFocus={() => !isReadOnly && setShowToolbar(true)}
          onBlur={() => setTimeout(() => setShowToolbar(false), 200)}
          className={`min-h-[500px] text-(--color-text-primary) outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-(--color-text-tertiary) ${
            isReadOnly ? 'cursor-not-allowed opacity-80' : ''
          }`}
          data-placeholder={isReadOnly ? t('knowledgeBase.readOnly') : t('knowledgeBase.startWriting')}
          style={{
            fontSize: '16px',
            lineHeight: '1.6',
          }}
          suppressContentEditableWarning
        />

        {/* File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileUpload}
          className="hidden"
          accept="*/*"
        />

        {/* Attachments Section */}
        {(attachments.length > 0 || loadingAttachments) && (
          <div className="mt-12 pt-8 border-t border-(--color-border)">
            <h3 className="text-base font-semibold text-(--color-text-primary) mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-xl">attach_file</span>
              {loadingAttachments ? t('common.loading') : t('knowledgeBase.attachments', { count: attachments.length })}
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {loadingAttachments ? (
                <>
                  <AttachmentSkeleton />
                  <AttachmentSkeleton />
                </>
              ) : (
                attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="animate-fadeIn flex items-center gap-4 p-4 bg-(--color-bg-secondary) border border-(--color-border) rounded-xl hover:border-(--color-accent) hover:shadow-md transition-all duration-200 group cursor-pointer"
                  >
                    <div className="shrink-0 w-12 h-12 bg-(--color-bg-tertiary) rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-(--color-accent) text-2xl">
                        {getFileIcon(attachment.type)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-(--color-text-primary) truncate">
                        {attachment.name}
                      </p>
                      <p className="text-sm text-(--color-text-secondary)">
                        {formatBytes(attachment.size)}
                      </p>
                    </div>
                    {attachment.url && (
                      <a
                        href={attachment.url}
                        download={attachment.name}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-(--color-bg-tertiary) rounded-lg transition-all duration-200"
                        title={t('knowledgeBase.downloadAttachment')}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="material-symbols-outlined text-lg text-(--color-accent)">download</span>
                      </a>
                    )}
                    <button
                      onClick={() => handleRemoveAttachment(attachment.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 hover:bg-(--color-bg-tertiary) rounded-lg transition-all duration-200 cursor-pointer"
                      title={t('knowledgeBase.removeAttachment')}
                    >
                      <span className="material-symbols-outlined text-lg text-red-500">close</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </PerfectScrollbarWrapper>
  );
}
