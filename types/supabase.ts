export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      kb_folders: {
        Row: {
          id: string
          user_id: string | null
          name: string
          icon: string | null
          is_active: boolean | null
          is_system: boolean | null
          folder_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          icon?: string | null
          is_active?: boolean | null
          is_system?: boolean | null
          folder_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          icon?: string | null
          is_active?: boolean | null
          is_system?: boolean | null
          folder_type?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      kb_documents: {
        Row: {
          id: string
          folder_id: string
          user_id: string | null
          title: string
          icon: string | null
          content: string | null
          document_type: string | null
          source_url: string | null
          published_date: string | null
          language: string | null
          raw_content: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          folder_id: string
          user_id?: string | null
          title?: string
          icon?: string | null
          content?: string | null
          document_type?: string | null
          source_url?: string | null
          published_date?: string | null
          language?: string | null
          raw_content?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          folder_id?: string
          user_id?: string | null
          title?: string
          icon?: string | null
          content?: string | null
          document_type?: string | null
          source_url?: string | null
          published_date?: string | null
          language?: string | null
          raw_content?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      kb_attachments: {
        Row: {
          id: string
          document_id: string
          name: string
          type: string
          size: number
          storage_path: string
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          name: string
          type: string
          size: number
          storage_path: string
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          name?: string
          type?: string
          size?: number
          storage_path?: string
          created_at?: string
        }
      }
      chat_conversations: {
        Row: {
          id: string
          user_id: string | null
          title: string
          created_at: string
          updated_at: string
          is_archived: boolean | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          title?: string
          created_at?: string
          updated_at?: string
          is_archived?: boolean | null
        }
        Update: {
          id?: string
          user_id?: string | null
          title?: string
          created_at?: string
          updated_at?: string
          is_archived?: boolean | null
        }
      }
      chat_messages: {
        Row: {
          id: string
          conversation_id: string
          role: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: string
          content?: string
          created_at?: string
        }
      }
      user_plans: {
        Row: {
          id: string
          user_id: string
          plan_type: string
          status: string
          started_at: string
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_type?: string
          status?: string
          started_at?: string
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_type?: string
          status?: string
          started_at?: string
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
