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

const GUEST_CONVERSATION_KEY = 'guestConversation';

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
      // Load guest conversation from localStorage
      loadGuestConversation();
    }
  }, [isAuthenticated, conversationId]);

  function loadGuestConversation() {
    try {
      const stored = localStorage.getItem(GUEST_CONVERSATION_KEY);
      if (stored) {
        const guestData = JSON.parse(stored);
        setMessages(guestData.messages || []);
        console.log('[useChatMessages] Loaded guest conversation from localStorage:', guestData.messages?.length, 'messages');
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('[useChatMessages] Error loading guest conversation:', error);
      setMessages([]);
    }
  }

  function saveGuestConversation(msgs: Message[]) {
    try {
      const guestData = {
        conversationId: `guest-${Date.now()}`,
        messages: msgs,
        createdAt: new Date().toISOString()
      };
      localStorage.setItem(GUEST_CONVERSATION_KEY, JSON.stringify(guestData));
      console.log('[useChatMessages] Saved guest conversation to localStorage:', msgs.length, 'messages');
    } catch (error) {
      console.error('[useChatMessages] Error saving guest conversation:', error);
    }
  }

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
    setMessages(prev => {
      const updated = [...prev, message];
      // Save to localStorage if guest user
      if (!isAuthenticated) {
        saveGuestConversation(updated);
      }
      return updated;
    });
  }

  function addMessages(newMessages: Message[]) {
    setMessages(prev => {
      const updated = [...prev, ...newMessages];
      // Save to localStorage if guest user
      if (!isAuthenticated) {
        saveGuestConversation(updated);
      }
      return updated;
    });
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
