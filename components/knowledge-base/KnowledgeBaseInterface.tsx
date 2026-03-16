'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import PerfectScrollbarWrapper from '../ui/PerfectScrollbar';
import EnhancedDocumentEditor from './EnhancedDocumentEditor';
import DocumentList from './DocumentList';
import FolderList from './FolderList';
import TemplateSelector from './TemplateSelector';
import type { Document, Folder } from './types';
import type { DocumentTemplate } from '@/lib/kb/templates';
import * as kbApi from '@/lib/api/kb';
import { toast } from 'sonner';

interface KnowledgeBaseInterfaceProps {
  userEmail?: string;
  userName?: string;
  initialDocumentId?: string;
}

export default function KnowledgeBaseInterface({ userEmail, userName, initialDocumentId }: KnowledgeBaseInterfaceProps) {
  const t = useTranslations();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showDocList, setShowDocList] = useState(true);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Load folders from API on mount
  useEffect(() => {
    loadFolders();
  }, []);

  // Load documents when folder changes
  useEffect(() => {
    if (selectedFolder) {
      loadDocuments(selectedFolder.id);
    }
  }, [selectedFolder]);

  // Handle initial document ID from URL
  useEffect(() => {
    if (initialDocumentId && documents.length > 0) {
      const doc = documents.find(d => d.id === initialDocumentId);
      if (doc) {
        setSelectedDoc(doc);
        setShowDocList(false);
        // Scroll to document in list if needed
        toast.success(t('success.documentLoadedFromChat'));
      }
    }
  }, [initialDocumentId, documents]);

  async function loadFolders() {
    try {
      setLoadingFolders(true);
      setError(null);
      const fetchedFolders = await kbApi.fetchFolders();
      
      // Convert API response to component format
      const convertedFolders: Folder[] = fetchedFolders.map(f => ({
        id: f.id,
        name: f.name,
        icon: f.icon || 'folder',
        isActive: f.is_active || false,
        createdAt: new Date(f.created_at),
        isSystem: f.is_system || false
      }));
      
      setFolders(convertedFolders);
      
      // Select first folder by default
      if (convertedFolders.length > 0 && !selectedFolder) {
        setSelectedFolder(convertedFolders[0]);
      }
    } catch (err: any) {
      console.error('Error loading folders:', err);
      setError(err.message);
    } finally {
      setLoadingFolders(false);
    }
  }

  async function loadDocuments(folderId: string) {
    try {
      setLoadingDocuments(true);
      const fetchedDocs = await kbApi.fetchDocuments(folderId);
      
      // Convert API response to component format
      const convertedDocs: Document[] = fetchedDocs.map(d => ({
        id: d.id,
        title: d.title,
        icon: d.icon || 'description',
        lastEdited: new Date(d.updated_at),
        content: d.content || '',
        folderId: d.folder_id,
        documentType: d.document_type as 'user' | 'gov_crawled' | undefined
      }));
      
      setDocuments(convertedDocs);
    } catch (err: any) {
      console.error('Error loading documents:', err);
      setError(err.message);
    } finally {
      setLoadingDocuments(false);
    }
  }

  const currentFolderDocs = documents.filter(doc => doc.folderId === selectedFolder?.id);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      const newFolder = await kbApi.createFolder(newFolderName.trim());
      
      const convertedFolder: Folder = {
        id: newFolder.id,
        name: newFolder.name,
        icon: newFolder.icon || 'folder',
        isActive: newFolder.is_active || false,
        createdAt: new Date(newFolder.created_at),
        isSystem: false
      };
      
      setFolders([...folders, convertedFolder]);
      setSelectedFolder(convertedFolder);
      setNewFolderName('');
      setShowNewFolderInput(false);
    } catch (err: any) {
      console.error('Error creating folder:', err);
      setError(err.message);
    }
  };

  const handleCreateDocument = async (template?: DocumentTemplate) => {
    if (!selectedFolder) return;
    
    try {
      let content = '';
      let title = t('knowledgeBase.untitled');
      let icon = 'description';
      
      if (template) {
        content = JSON.stringify({ blocks: template.blocks, version: 2 });
        title = template.name;
        icon = template.icon;
      }
      
      const newDoc = await kbApi.createDocument(
        selectedFolder.id,
        title,
        icon,
        content
      );
      
      const convertedDoc: Document = {
        id: newDoc.id,
        title: newDoc.title,
        icon: newDoc.icon || 'description',
        lastEdited: new Date(newDoc.updated_at),
        content: newDoc.content || '',
        folderId: newDoc.folder_id
      };
      
      setDocuments([convertedDoc, ...documents]);
      setSelectedDoc(convertedDoc);
    } catch (err: any) {
      console.error('Error creating document:', err);
      setError(err.message);
    }
  };

  const handleUpdateDocument = async (id: string, updates: Partial<Document>) => {
    try {
      const apiUpdates: any = {};
      if (updates.title !== undefined) apiUpdates.title = updates.title;
      if (updates.icon !== undefined) apiUpdates.icon = updates.icon;
      if (updates.content !== undefined) apiUpdates.content = updates.content;
      
      const updatedDoc = await kbApi.updateDocument(id, apiUpdates);
      
      const convertedDoc: Document = {
        id: updatedDoc.id,
        title: updatedDoc.title,
        icon: updatedDoc.icon || 'description',
        lastEdited: new Date(updatedDoc.updated_at),
        content: updatedDoc.content || '',
        folderId: updatedDoc.folder_id
      };
      
      setDocuments(docs => docs.map(doc => 
        doc.id === id ? convertedDoc : doc
      ));
      
      if (selectedDoc?.id === id) {
        setSelectedDoc(convertedDoc);
      }
    } catch (err: any) {
      console.error('Error updating document:', err);
      setError(err.message);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await kbApi.deleteDocument(id);
      
      setDocuments(docs => docs.filter(doc => doc.id !== id));
      
      if (selectedDoc?.id === id) {
        const remainingDocs = documents.filter(doc => doc.id !== id && doc.folderId === selectedFolder?.id);
        setSelectedDoc(remainingDocs[0] || null);
      }
    } catch (err: any) {
      console.error('Error deleting document:', err);
      toast.error(t('errors.deleteDocumentFailed'), {
        description: err.message
      });
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      // First delete from API
      await kbApi.deleteFolder(id);
      
      // Only update UI state after successful deletion
      const updatedFolders = folders.filter(f => f.id !== id);
      setFolders(updatedFolders);
      setDocuments(documents.filter(doc => doc.folderId !== id));
      
      if (selectedFolder?.id === id) {
        setSelectedFolder(updatedFolders[0] || null);
        setSelectedDoc(null);
      }
    } catch (err: any) {
      console.error('Error deleting folder:', err);
      // Show user-friendly error message
      toast.error(t('errors.deleteFolderFailed'), {
        description: err.message
      });
      // Reload folders to sync with server state
      loadFolders();
    }
  };

  const handleEditFolder = async (id: string, name: string) => {
    try {
      // Check if folder is a system folder
      const folder = folders.find(f => f.id === id);
      if (folder?.isSystem) {
        toast.error(t('errors.cannotEditSystemFolder'), {
          description: t('errors.systemFoldersCannotBeModified')
        });
        return;
      }
      
      const updatedFolder = await kbApi.updateFolder(id, { name });
      
      const convertedFolder: Folder = {
        id: updatedFolder.id,
        name: updatedFolder.name,
        icon: updatedFolder.icon || 'folder',
        isActive: updatedFolder.is_active || false,
        createdAt: new Date(updatedFolder.created_at),
        isSystem: updatedFolder.is_system || false
      };
      
      setFolders(folders.map(f => f.id === id ? convertedFolder : f));
      
      if (selectedFolder?.id === id) {
        setSelectedFolder(convertedFolder);
      }
    } catch (err: any) {
      console.error('Error editing folder:', err);
      toast.error(t('errors.editFolderFailed'), {
        description: err.message
      });
    }
  };

  const handleEditDocument = async (id: string, title: string) => {
    try {
      const updatedDoc = await kbApi.updateDocument(id, { title });
      
      const convertedDoc: Document = {
        id: updatedDoc.id,
        title: updatedDoc.title,
        icon: updatedDoc.icon || 'description',
        lastEdited: new Date(updatedDoc.updated_at),
        content: updatedDoc.content || '',
        folderId: updatedDoc.folder_id,
        documentType: updatedDoc.document_type as 'user' | 'gov_crawled' | undefined
      };
      
      setDocuments(docs => docs.map(doc => doc.id === id ? convertedDoc : doc));
      
      if (selectedDoc?.id === id) {
        setSelectedDoc(convertedDoc);
      }
    } catch (err: any) {
      console.error('Error editing document:', err);
      toast.error(t('errors.editDocumentFailed'), {
        description: err.message
      });
    }
  };

  if (loadingFolders) {
    return (
      <div className="flex-1 flex items-center justify-center bg-(--color-bg-primary)">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-(--color-accent) border-t-transparent animate-spin"></div>
          <p className="text-(--color-text-secondary)">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-(--color-bg-primary)">
        <div className="text-center max-w-md px-6">
          <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
          <h3 className="text-xl font-semibold text-(--color-text-primary) mb-2">{t('common.error')}</h3>
          <p className="text-(--color-text-secondary) mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              loadFolders();
            }}
            className="px-6 py-2 bg-(--color-accent) text-white rounded-lg hover:bg-(--color-accent-hover) transition-colors cursor-pointer"
          >
            {t('knowledgeBaseInterface.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelect={(template) => handleCreateDocument(template)}
      />
      
      {/* Document List Sidebar */}
      <div 
        className={`bg-(--color-bg-secondary) border-r border-(--color-border) flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
          showDocList ? 'w-72 opacity-100' : 'w-0 opacity-0'
        }`}
      >
        <div className="w-72 flex flex-col h-full">
          <div className="p-5 border-b border-(--color-border)">
            <h2 className="text-lg font-bold text-(--color-text-primary) mb-1">{t('knowledgeBase.title')}</h2>
            <p className="text-sm text-(--color-text-secondary)">{t('knowledgeBase.subtitle')}</p>
          </div>

          {/* Folder Section */}
          <div className="border-b border-(--color-border)">
            <div className="p-3">
              <h3 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wider mb-3">
                {t('knowledgeBase.folders')}
              </h3>
              
              <button
                onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-(--color-accent) text-white rounded-lg hover:bg-(--color-accent-hover) transition-all duration-200 font-medium cursor-pointer shadow-sm hover:shadow-md text-sm mb-3"
              >
                <span className="material-symbols-outlined text-xl">
                  {showNewFolderInput ? 'close' : 'create_new_folder'}
                </span>
                <span>{showNewFolderInput ? t('common.cancel') : t('knowledgeBase.newFolder')}</span>
              </button>

              {showNewFolderInput && (
                <div className="mb-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                      placeholder={t('knowledgeBase.folderNamePlaceholder')}
                      className="flex-1 px-3 py-2 text-sm bg-(--color-bg-primary) border border-(--color-border) rounded-lg outline-none focus:border-(--color-accent) text-(--color-text-primary)"
                      autoFocus
                    />
                    <button
                      onClick={handleCreateFolder}
                      className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer"
                      title={t('common.create')}
                    >
                      <span className="material-symbols-outlined text-lg">check</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-3 pb-3 max-h-48 overflow-y-auto">
              <FolderList
                folders={folders}
                selectedFolder={selectedFolder}
                onSelectFolder={setSelectedFolder}
                onDeleteFolder={handleDeleteFolder}
                onEditFolder={handleEditFolder}
                loading={false}
              />
            </div>
          </div>

          {/* Documents in Selected Folder */}
          {selectedFolder && (
            <>
              {/* Only show create buttons for non-system folders */}
              {!selectedFolder.isSystem && (
                <div className="p-3 border-b border-(--color-border) space-y-2">
                  <button
                    onClick={() => handleCreateDocument()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-(--color-accent) text-white rounded-lg hover:bg-(--color-accent-hover) transition-all duration-200 font-medium cursor-pointer shadow-sm hover:shadow-md text-sm"
                  >
                    <span className="material-symbols-outlined text-xl">add</span>
                    <span>{t('knowledgeBase.newDocument')}</span>
                  </button>
                  <button
                    onClick={() => setShowTemplateSelector(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-(--color-bg-tertiary) text-(--color-text-primary) rounded-lg hover:bg-(--color-bg-tertiary)/80 transition-all duration-200 font-medium cursor-pointer text-sm border border-(--color-border)"
                  >
                    <span className="material-symbols-outlined text-xl">description</span>
                    <span>{t('knowledgeBase.fromTemplate')}</span>
                  </button>
                </div>
              )}

              {/* System folder notice */}
              {selectedFolder.isSystem && (
                <div className="p-3 border-b border-(--color-border)">
                  <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <span className="material-symbols-outlined text-blue-500 text-lg shrink-0">lock</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-blue-500 mb-1">{t('knowledgeBase.systemFolder')}</p>
                      <p className="text-xs text-(--color-text-secondary)">{t('knowledgeBase.systemFolderDescription')}</p>
                    </div>
                  </div>
                </div>
              )}

              <PerfectScrollbarWrapper className="flex-1 px-3">
                <div className="py-2">
                  <div className="flex items-center justify-between mb-2 px-3">
                    <h3 className="text-xs font-semibold text-(--color-text-secondary) uppercase tracking-wider">
                      {selectedFolder.name}
                    </h3>
                    {selectedFolder.isSystem && (
                      <span className="flex items-center gap-1 text-xs text-blue-500">
                        <span className="material-symbols-outlined text-sm">lock</span>
                        <span>{t('knowledgeBase.readOnly')}</span>
                      </span>
                    )}
                  </div>
                  <DocumentList
                    documents={currentFolderDocs}
                    selectedDoc={selectedDoc}
                    onSelectDoc={setSelectedDoc}
                    onDeleteDoc={handleDeleteDocument}
                    onEditDoc={handleEditDocument}
                    loading={loadingDocuments}
                  />
                </div>
              </PerfectScrollbarWrapper>

              <div className="p-4 border-t border-(--color-border)">
                <div className="flex items-center gap-2 text-sm text-(--color-text-secondary)">
                  <span className="material-symbols-outlined text-lg">description</span>
                  <span>{currentFolderDocs.length} {currentFolderDocs.length === 1 ? t('knowledgeBase.documents') : t('knowledgeBase.documentsPlural')}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col h-full bg-(--color-bg-primary)">
        {/* Top Bar */}
        <div className="h-14 border-b border-(--color-border) flex items-center justify-between px-6 bg-(--color-bg-secondary) shrink-0">
          <button
            onClick={() => setShowDocList(!showDocList)}
            className="p-2 hover:bg-(--color-bg-tertiary) rounded-lg transition-all duration-200 cursor-pointer group"
            title={showDocList ? t('knowledgeBase.hideSidebar') : t('knowledgeBase.showSidebar')}
          >
            <span className="material-symbols-outlined text-(--color-text-secondary) group-hover:text-(--color-text-primary) text-xl transition-colors duration-200">
              {showDocList ? 'chevron_left' : 'chevron_right'}
            </span>
          </button>
          
          <div className="flex items-center gap-4 text-sm text-(--color-text-secondary)">
            {selectedDoc && (
              <>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">schedule</span>
                  <span>{t('knowledgeBase.edited', { date: selectedDoc.lastEdited.toLocaleString() })}</span>
                </div>
                <button className="p-2 hover:bg-(--color-bg-tertiary) rounded-lg transition-all duration-200 cursor-pointer">
                  <span className="material-symbols-outlined text-lg">more_horiz</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Editor */}
        {selectedDoc ? (
          <EnhancedDocumentEditor
            document={selectedDoc}
            onUpdate={(updates: Partial<Document>) => handleUpdateDocument(selectedDoc.id, updates)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-6">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-(--color-bg-secondary) border border-(--color-border) flex items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-(--color-text-tertiary)">description</span>
              </div>
              <h3 className="text-xl font-semibold text-(--color-text-primary) mb-2">No document selected</h3>
              <p className="text-(--color-text-secondary) mb-6">
                {selectedFolder 
                  ? 'Create a new document or select one from the sidebar' 
                  : 'Create a folder first to organize your documents'}
              </p>
              {selectedFolder && (
                <button
                  onClick={() => handleCreateDocument()}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-(--color-accent) text-white rounded-lg hover:bg-(--color-accent-hover) transition-all duration-200 cursor-pointer font-medium shadow-sm hover:shadow-md"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  <span>Create your first document</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
