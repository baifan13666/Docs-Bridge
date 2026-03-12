import { useState, useEffect, useCallback } from 'react';

export function useGuestMode(isAuthenticated: boolean) {
  const [guestQueryUsed, setGuestQueryUsed] = useState(false);

  // Load guest query status from localStorage on mount
  useEffect(() => {
    console.log('[useGuestMode] Mount/Auth change - isAuthenticated:', isAuthenticated);
    if (!isAuthenticated) {
      const stored = localStorage.getItem('guestQueryUsed');
      console.log('[useGuestMode] Guest mode - localStorage guestQueryUsed:', stored);
      if (stored === 'true') {
        setGuestQueryUsed(true);
      }
    } else {
      console.log('[useGuestMode] Authenticated mode - clearing guest status');
      // Clear guest query status when user is authenticated
      localStorage.removeItem('guestQueryUsed');
      setGuestQueryUsed(false);
    }
  }, [isAuthenticated]);

  // Migrate guest conversation to database after login
  const migrateGuestConversation = useCallback(async () => {
    try {
      const guestConvStr = localStorage.getItem('guestConversation');
      if (!guestConvStr) {
        console.log('[useGuestMode] No guest conversation to migrate');
        return;
      }

      const guestConv = JSON.parse(guestConvStr);
      if (!guestConv.messages || guestConv.messages.length === 0) {
        console.log('[useGuestMode] Guest conversation has no messages');
        localStorage.removeItem('guestConversation');
        return;
      }

      console.log('[useGuestMode] Migrating guest conversation with', guestConv.messages.length, 'messages');

      const response = await fetch('/api/chat/migrate-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: guestConv.messages,
          title: guestConv.messages[0]?.content?.substring(0, 50) || 'Migrated Chat'
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[useGuestMode] Successfully migrated guest conversation:', data.conversation.id);
        localStorage.removeItem('guestConversation');
      } else {
        console.error('[useGuestMode] Failed to migrate guest conversation:', await response.text());
      }
    } catch (error) {
      console.error('[useGuestMode] Error migrating guest conversation:', error);
    }
  }, []);

  function markGuestQueryAsUsed() {
    console.log('[useGuestMode] Marking guest query as used');
    setGuestQueryUsed(true);
    localStorage.setItem('guestQueryUsed', 'true');
  }

  return {
    guestQueryUsed,
    setGuestQueryUsed: markGuestQueryAsUsed,
    migrateGuestConversation
  };
}
