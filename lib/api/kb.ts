// API client functions for Knowledge Base

export interface KBFolder {
  id: string;
  user_id: string | null;
  name: string;
  icon: string | null;
  is_active: boolean | null;
  is_system: boolean | null;
  folder_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface KBDocument {
  id: string;
  folder_id: string;
  user_id: string | null;
  title: string;
  icon: string | null;
  content: string | null;
  document_type: string | null;
  source_url: string | null;
  published_date: string | null;
  language: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// FOLDERS
// ============================================

export async function fetchFolders(): Promise<KBFolder[]> {
  const response = await fetch('/api/kb/folders');
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch folders');
  }
  
  return data.folders;
}

export async function createFolder(name: string, icon: string = 'folder'): Promise<KBFolder> {
  const response = await fetch('/api/kb/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, icon })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Failed to create folder');
  }
  
  return data.folder;
}

export async function updateFolder(
  id: string,
  updates: { name?: string; icon?: string; is_active?: boolean }
): Promise<KBFolder> {
  const response = await fetch(`/api/kb/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update folder');
  }
  
  return data.folder;
}

export async function deleteFolder(id: string): Promise<void> {
  const response = await fetch(`/api/kb/folders/${id}`, {
    method: 'DELETE'
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Failed to delete folder');
  }
}

// ============================================
// DOCUMENTS
// ============================================

export async function fetchDocuments(
  folderId?: string,
  documentType?: 'user' | 'gov_crawled'
): Promise<KBDocument[]> {
  const params = new URLSearchParams();
  if (folderId) params.append('folder_id', folderId);
  if (documentType) params.append('document_type', documentType);
  
  const response = await fetch(`/api/kb/documents?${params.toString()}`);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch documents');
  }
  
  return data.documents;
}

export async function fetchDocument(id: string): Promise<KBDocument> {
  const response = await fetch(`/api/kb/documents/${id}`);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Failed to fetch document');
  }
  
  return data.document;
}

export async function createDocument(
  folderId: string,
  title: string,
  icon: string = 'description',
  content?: string
): Promise<KBDocument> {
  const response = await fetch('/api/kb/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId, title, icon, content })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Failed to create document');
  }
  
  return data.document;
}

export async function updateDocument(
  id: string,
  updates: { title?: string; icon?: string; content?: string }
): Promise<KBDocument> {
  const response = await fetch(`/api/kb/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Failed to update document');
  }
  
  return data.document;
}

export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`/api/kb/documents/${id}`, {
    method: 'DELETE'
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Failed to delete document');
  }
}

// ============================================
// ATTACHMENTS
// ============================================

export interface KBAttachment {
  id: string;
  document_id: string;
  name: string;
  type: string;
  size: number;
  storage_path: string;
  url?: string;
  created_at: string;
}

export async function uploadAttachment(documentId: string, file: File): Promise<KBAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentId', documentId);

  const response = await fetch('/api/kb/attachments', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to upload attachment');
  }

  return data;
}

export async function fetchAttachments(documentId: string): Promise<KBAttachment[]> {
  const response = await fetch(`/api/kb/attachments?documentId=${documentId}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch attachments');
  }

  return data;
}

export async function deleteAttachment(id: string): Promise<void> {
  const response = await fetch(`/api/kb/attachments/${id}`, {
    method: 'DELETE',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to delete attachment');
  }
}
