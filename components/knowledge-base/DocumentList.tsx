'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Document } from './types';
import { DocumentSkeleton } from '../ui/Skeleton';

interface DocumentListProps {
  documents: Document[];
  selectedDoc: Document | null;
  onSelectDoc: (doc: Document) => void;
  onDeleteDoc: (id: string) => void;
  onEditDoc: (id: string, title: string) => void;
  loading?: boolean;
}

export default function DocumentList({ 
  documents, 
  selectedDoc, 
  onSelectDoc, 
  onDeleteDoc,
  onEditDoc,
  loading = false
}: DocumentListProps) {
  const t = useTranslations();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  if (loading) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2, 3, 4].map((i) => (
          <DocumentSkeleton key={i} />
        ))}
      </div>
    );
  }
  
  const handleStartEdit = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(doc.id);
    setEditTitle(doc.title);
  };
  
  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      onEditDoc(id, editTitle.trim());
    }
    setEditingId(null);
  };
  
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };
  
  return (
    <div className="space-y-1 py-2">
      {documents.map((doc) => {
        const isEditing = editingId === doc.id;
        const canEdit = doc.documentType !== 'gov_crawled';
        
        return (
          <div
            key={doc.id}
            className={`animate-fadeIn group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              isEditing ? 'bg-(--color-bg-tertiary)' :
              selectedDoc?.id === doc.id
                ? 'bg-(--color-accent)/10 text-(--color-text-primary) border border-(--color-accent)/20 cursor-pointer'
                : 'hover:bg-(--color-bg-tertiary) text-(--color-text-secondary) cursor-pointer'
            }`}
            onClick={() => !isEditing && onSelectDoc(doc)}
          >
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
              selectedDoc?.id === doc.id ? 'bg-(--color-accent)/20' : 'bg-(--color-bg-primary)'
            }`}>
              <span className={`material-symbols-outlined text-xl ${
                selectedDoc?.id === doc.id ? 'text-(--color-accent)' : 'text-(--color-text-secondary)'
              }`}>{doc.icon}</span>
            </div>
            
            {isEditing ? (
              <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(doc.id);
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="flex-1 px-2 py-1 text-sm bg-(--color-bg-primary) border border-(--color-accent) rounded outline-none text-(--color-text-primary)"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveEdit(doc.id)}
                  className="p-1 hover:bg-(--color-bg-primary) rounded transition-colors cursor-pointer"
                  title={t('common.save')}
                >
                  <span className="material-symbols-outlined text-base text-green-500">check</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1 hover:bg-(--color-bg-primary) rounded transition-colors cursor-pointer"
                  title={t('common.cancel')}
                >
                  <span className="material-symbols-outlined text-base text-(--color-text-secondary)">close</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <p className="text-xs text-(--color-text-tertiary) truncate">
                    {doc.lastEdited.toLocaleDateString()}
                  </p>
                </div>
                
                {canEdit && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleStartEdit(doc, e)}
                      className="p-1.5 hover:bg-(--color-bg-primary) rounded-md transition-all duration-200 cursor-pointer"
                      title={t('common.edit')}
                    >
                      <span className="material-symbols-outlined text-base text-(--color-text-secondary)">edit</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(t('knowledgeBase.deleteDocument'))) {
                          onDeleteDoc(doc.id);
                        }
                      }}
                      className="p-1.5 hover:bg-(--color-bg-primary) rounded-md transition-all duration-200 cursor-pointer"
                      title={t('common.delete')}
                    >
                      <span className="material-symbols-outlined text-lg text-red-500">delete</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
