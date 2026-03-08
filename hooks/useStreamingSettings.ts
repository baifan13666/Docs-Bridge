/**
 * Streaming Settings Hook
 * 
 * Manages user preference for streaming vs non-streaming responses
 */

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'docsbridge_streaming_enabled';

export function useStreamingSettings() {
  const [streamingEnabled, setStreamingEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true; // Default to streaming
    
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === 'true' : true;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(streamingEnabled));
    }
  }, [streamingEnabled]);

  const toggleStreaming = () => {
    setStreamingEnabled(prev => !prev);
  };

  return {
    streamingEnabled,
    setStreamingEnabled,
    toggleStreaming,
  };
}
