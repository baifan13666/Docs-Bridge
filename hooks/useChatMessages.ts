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

  function dedupeMessages(items: Message[]) {
    const seenIds = new Set<string>();
    const seenSignatures = new Set<string>();
    const deduped: Message[] = [];

    for (const msg of items) {
      if (msg.id && seenIds.has(msg.id)) {
        continue;
      }
      const signature = `${msg.role}|${msg.content}|${msg.created_at}`;
      if (seenSignatures.has(signature)) {
        continue;
      }
      if (msg.id) seenIds.add(msg.id);
      seenSignatures.add(signature);
      deduped.push(msg);
    }

    return deduped;
  }

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
      const signatureCounts = new Map<string, number>();
      convertedMessages.forEach(msg => {
        const signature = `${msg.role}|${msg.content}|${msg.created_at}`;
        signatureCounts.set(signature, (signatureCounts.get(signature) || 0) + 1);
      });
      const duplicateSignatures = Array.from(signatureCounts.entries()).filter(([, count]) => count > 1);
      if (duplicateSignatures.length > 0) {
        console.warn('[useChatMessages] Duplicate messages detected from API:', duplicateSignatures.slice(0, 5));
      }
      
      setMessages(dedupeMessages(convertedMessages));
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }

  function addMessage(message: Message) {
    setMessages(prev => {
      const updated = dedupeMessages([...prev, message]);
      // Save to localStorage if guest user
      if (!isAuthenticated) {
        saveGuestConversation(updated);
      }
      return updated;
    });
  }

  function addMessages(newMessages: Message[]) {
    setMessages(prev => {
      const updated = dedupeMessages([...prev, ...newMessages]);
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
