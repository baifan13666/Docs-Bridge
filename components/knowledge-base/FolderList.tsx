import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Folder } from './types';

import { FolderSkeleton } from '../ui/Skeleton';

interface FolderListProps {
  folders: Folder[];
  selectedFolder: Folder | null;
  onSelectFolder: (folder: Folder) => void;
  onDeleteFolder: (id: string) => void;
  onEditFolder: (id: string, name: string) => void;
  loading?: boolean;
}

export default function FolderList({ 
  folders, 
  selectedFolder, 
  onSelectFolder, 
  onDeleteFolder,
  onEditFolder,
  loading = false
}: FolderListProps) {
  const t = useTranslations();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  if (loading) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2, 3].map((i) => (
          <FolderSkeleton key={i} />
        ))}
      </div>
    );
  }
  
  const handleStartEdit = (folder: Folder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(folder.id);
    setEditName(folder.name);
  };
  
  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      onEditFolder(id, editName.trim());
    }
    setEditingId(null);
  };
  
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };
  
  return (
    <div className="space-y-1 py-2">
      {folders.map((folder) => {
        const isEditing = editingId === folder.id;
        const canEdit = !folder.isSystem;
        
        return (
          <div
            key={folder.id}
            className={`animate-fadeIn group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
              isEditing ? 'bg-(--color-bg-tertiary)' :
              selectedFolder?.id === folder.id
                ? 'bg-(--color-accent)/10 text-(--color-text-primary) border border-(--color-accent)/20 cursor-pointer'
                : 'hover:bg-(--color-bg-tertiary) text-(--color-text-secondary) cursor-pointer'
            }`}
            onClick={() => !isEditing && onSelectFolder(folder)}
          >
            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
              selectedFolder?.id === folder.id ? 'bg-(--color-accent)/20' : 'bg-(--color-bg-primary)'
            }`}>
              <span className={`material-symbols-outlined text-xl ${
                selectedFolder?.id === folder.id ? 'text-(--color-accent)' : 'text-(--color-text-secondary)'
              }`}>{folder.icon}</span>
            </div>
            
            {isEditing ? (
              <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(folder.id);
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="flex-1 px-2 py-1 text-sm bg-(--color-bg-primary) border border-(--color-accent) rounded outline-none text-(--color-text-primary)"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveEdit(folder.id)}
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
                  <p className="text-sm font-medium truncate">{folder.name}</p>
                  <p className="text-xs text-(--color-text-tertiary) truncate">
                    {folder.createdAt.toLocaleDateString()}
                  </p>
                </div>
                
                {canEdit && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleStartEdit(folder, e)}
                      className="p-1.5 hover:bg-(--color-bg-primary) rounded-md transition-all duration-200 cursor-pointer"
                      title={t('common.edit')}
                    >
                      <span className="material-symbols-outlined text-base text-(--color-text-secondary)">edit</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(t('knowledgeBase.deleteFolder', { name: folder.name }))) {
                          onDeleteFolder(folder.id);
                        }
                      }}
                      className="p-1.5 hover:bg-(--color-bg-primary) rounded-md transition-all duration-200 cursor-pointer"
                      title={t('common.delete')}
                    >
                      <span className="material-symbols-outlined text-base text-red-500">delete</span>
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
