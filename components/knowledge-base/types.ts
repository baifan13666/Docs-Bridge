export interface Document {
  id: string;
  title: string;
  icon: string;
  lastEdited: Date;
  content?: string;
  folderId: string;
  documentType?: 'user' | 'gov_crawled';
}

export interface Folder {
  id: string;
  name: string;
  icon: string;
  isActive: boolean;
  isSystem?: boolean;
  createdAt: Date;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}
