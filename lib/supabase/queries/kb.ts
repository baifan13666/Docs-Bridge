import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type KBFolder = Database['public']['Tables']['kb_folders']['Row'];
type KBDocument = Database['public']['Tables']['kb_documents']['Row'];
type KBAttachment = Database['public']['Tables']['kb_attachments']['Row'];

// ============================================
// FOLDERS
// ============================================

export async function getFolders(userId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('kb_folders')
    .select('*')
    .or(`user_id.eq.${userId},is_system.eq.true`)
    .order('is_system', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as KBFolder[];
}

export async function createFolder(userId: string, name: string, icon: string = 'folder') {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('kb_folders')
    .insert({
      user_id: userId,
      name,
      icon,
      is_active: false,
      is_system: false,
      folder_type: 'user'
    })
    .select()
    .single();

  if (error) throw error;
  return data as KBFolder;
}

export async function updateFolder(
  userId: string,
  folderId: string,
  updates: { name?: string; icon?: string; is_active?: boolean }
) {
  const supabase = await createClient();
  
  // Check ownership
  const { data: folder } = await supabase
    .from('kb_folders')
    .select('user_id, is_system')
    .eq('id', folderId)
    .single();

  if (!folder) throw new Error('Folder not found');
  
  // For system folders, only allow is_active updates
  if (folder.is_system) {
    // Check if trying to update anything other than is_active
    const hasOtherUpdates = updates.name !== undefined || updates.icon !== undefined;
    if (hasOtherUpdates) {
      throw new Error('Cannot modify system folder properties');
    }
    // Allow is_active update for system folders (no user_id check needed)
  } else {
    // For non-system folders, check user ownership
    if (folder.user_id !== userId) throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('kb_folders')
    .update(updates)
    .eq('id', folderId)
    .select()
    .single();

  if (error) throw error;
  return data as KBFolder;
}

export async function deleteFolder(userId: string, folderId: string) {
  const supabase = await createClient();
  
  // Check ownership
  const { data: folder } = await supabase
    .from('kb_folders')
    .select('user_id, is_system')
    .eq('id', folderId)
    .single();

  if (!folder) throw new Error('Folder not found');
  if (folder.is_system) throw new Error('Cannot delete system folder');
  if (folder.user_id !== userId) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('kb_folders')
    .delete()
    .eq('id', folderId);

  if (error) throw error;
}

// ============================================
// DOCUMENTS
// ============================================

export async function getDocuments(userId: string, folderId?: string, documentType?: 'user' | 'gov_crawled') {
  const supabase = await createClient();
  
  let query = supabase
    .from('kb_documents')
    .select('*')
    .or(`user_id.eq.${userId},document_type.eq.gov_crawled`);

  if (folderId) {
    query = query.eq('folder_id', folderId);
  }

  if (documentType) {
    query = query.eq('document_type', documentType);
  }

  query = query.order('updated_at', { ascending: false });

  const { data, error } = await query;

  if (error) throw error;
  return data as KBDocument[];
}

export async function getDocument(userId: string, documentId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('kb_documents')
    .select('*')
    .eq('id', documentId)
    .or(`user_id.eq.${userId},document_type.eq.gov_crawled`)
    .single();

  if (error) throw error;
  return data as KBDocument;
}

export async function createDocument(
  userId: string,
  folderId: string,
  title: string,
  icon: string = 'description',
  content?: string
) {
  const supabase = await createClient();
  
  // Verify folder ownership
  const { data: folder } = await supabase
    .from('kb_folders')
    .select('user_id, is_system')
    .eq('id', folderId)
    .single();

  if (!folder) throw new Error('Folder not found');
  if (!folder.is_system && folder.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('kb_documents')
    .insert({
      folder_id: folderId,
      user_id: userId,
      title,
      icon,
      content: content || '',
      document_type: 'user'
    })
    .select()
    .single();

  if (error) throw error;
  return data as KBDocument;
}

export async function updateDocument(
  userId: string,
  documentId: string,
  updates: { title?: string; icon?: string; content?: string }
) {
  const supabase = await createClient();
  
  // Check ownership
  const { data: doc } = await supabase
    .from('kb_documents')
    .select('user_id, document_type')
    .eq('id', documentId)
    .single();

  if (!doc) throw new Error('Document not found');
  if (doc.document_type === 'gov_crawled') throw new Error('Cannot modify government document');
  if (doc.user_id !== userId) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('kb_documents')
    .update(updates)
    .eq('id', documentId)
    .select()
    .single();

  if (error) throw error;
  return data as KBDocument;
}

export async function deleteDocument(userId: string, documentId: string) {
  const supabase = await createClient();
  
  // Check ownership
  const { data: doc } = await supabase
    .from('kb_documents')
    .select('user_id, document_type')
    .eq('id', documentId)
    .single();

  if (!doc) throw new Error('Document not found');
  if (doc.document_type === 'gov_crawled') throw new Error('Cannot delete government document');
  if (doc.user_id !== userId) throw new Error('Unauthorized');

  const { error } = await supabase
    .from('kb_documents')
    .delete()
    .eq('id', documentId);

  if (error) throw error;
}

// ============================================
// ATTACHMENTS
// ============================================

export async function getAttachments(userId: string, documentId: string) {
  const supabase = await createClient();
  
  // Verify document access
  const { data: doc } = await supabase
    .from('kb_documents')
    .select('user_id')
    .eq('id', documentId)
    .single();

  if (!doc) throw new Error('Document not found');
  if (doc.user_id !== userId) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('kb_attachments')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as KBAttachment[];
}

export async function createAttachment(
  userId: string,
  documentId: string,
  name: string,
  type: string,
  size: number,
  storagePath: string
) {
  const supabase = await createClient();
  
  // Verify document access
  const { data: doc } = await supabase
    .from('kb_documents')
    .select('user_id')
    .eq('id', documentId)
    .single();

  if (!doc) throw new Error('Document not found');
  if (doc.user_id !== userId) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('kb_attachments')
    .insert({
      document_id: documentId,
      name,
      type,
      size,
      storage_path: storagePath
    })
    .select()
    .single();

  if (error) throw error;
  return data as KBAttachment;
}

export async function deleteAttachment(userId: string, attachmentId: string) {
  const supabase = await createClient();
  
  // Get attachment and verify access
  const { data: attachment } = await supabase
    .from('kb_attachments')
    .select('document_id, storage_path')
    .eq('id', attachmentId)
    .single();

  if (!attachment) throw new Error('Attachment not found');

  // Verify document ownership
  const { data: doc } = await supabase
    .from('kb_documents')
    .select('user_id')
    .eq('id', attachment.document_id)
    .single();

  if (!doc || doc.user_id !== userId) throw new Error('Unauthorized');

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('attachments')
    .remove([attachment.storage_path]);

  if (storageError) throw storageError;

  // Delete from database
  const { error } = await supabase
    .from('kb_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) throw error;
}
