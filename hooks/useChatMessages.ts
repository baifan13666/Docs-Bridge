import { useState, useEffect, useRef } from 'react';
import * as chatApi from '@/lib/api/chat';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  sources?: chatApi.RAGQueryResult[];
  confidence?: chatApi.ConfidenceScore;
  metadata?: {
    language?: string;
    dialect?: string;
  };
}

export function useChatMessages(
  isAuthenticated: boolean,
  conversationId?: string
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const justCreatedConversation = useRef(false);

  useEffect(() => {
    if (isAuthenticated && conversationId) {
      if (justCreatedConversation.current) {
        justCreatedConversation.current = false;
        return;
      }
      loadMessages(conversationId);
    } else if (!isAuthenticated) {
      setMessages([]);
    }
  }, [isAuthenticated, conversationId]);

  async function loadMessages(convId: string) {
    try {
      setLoading(true);
      const fetchedMessages = await chatApi.fetchMessages(convId);
      
      const convertedMessages: Message[] = fetchedMessages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at
      }));
      
      setMessages(convertedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }

  function addMessage(message: Message) {
    setMessages(prev => [...prev, message]);
  }

  function addMessages(newMessages: Message[]) {
    setMessages(prev => [...prev, ...newMessages]);
  }

  function markConversationAsJustCreated() {
    justCreatedConversation.current = true;
  }

  return {
    messages,
    loading,
    addMessage,
    addMessages,
    setMessages,
    markConversationAsJustCreated
  };
}
