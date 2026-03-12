/**
 * Voice Output Hook
 * 
 * Uses Web Speech API for text-to-speech with fallback support
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVoiceOutputOptions {
  language?: string; // BCP 47 language code
  rate?: number; // 0.1 to 10, default 1
  pitch?: number; // 0 to 2, default 1
  volume?: number; // 0 to 1, default 1
}

export function useVoiceOutput(options: UseVoiceOutputOptions = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [missingVoiceWarning, setMissingVoiceWarning] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    // Check if Web Speech API is supported
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);

      // Load available voices
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      // Cancel any ongoing speech
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string, customOptions?: UseVoiceOutputOptions) => {
    if (!isSupported || !text.trim()) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    setMissingVoiceWarning(null);

    const utterance = new SpeechSynthesisUtterance(text);
    const opts = { ...options, ...customOptions };

    // Set language
    if (opts.language) {
      utterance.lang = opts.language;
      
      // Try to find a voice for this language
      // For Chinese, prefer voices that match the exact locale (zh-CN, zh-TW, etc.)
      let voice = availableVoices.find(v => v.lang === opts.language);
      
      // If exact match not found, try language prefix match
      if (!voice) {
        const langPrefix = opts.language.split('-')[0];
        voice = availableVoices.find(v => v.lang.startsWith(langPrefix));
      }
      
      if (voice) {
        console.log('[VoiceOutput] Using voice:', voice.name, voice.lang);
        utterance.voice = voice;
      } else {
        // No voice found - try to use default voice anyway
        console.warn('[VoiceOutput] No voice found for language:', opts.language);
        console.log('[VoiceOutput] Available voices:', availableVoices.map(v => `${v.name} (${v.lang})`).join(', '));
        
        // Set warning message for user - but only if we're actually going to speak
        const languageNames: Record<string, string> = {
          'zh-CN': 'Chinese (Simplified)',
          'zh-TW': 'Chinese (Traditional)',
          'ms-MY': 'Malay',
          'id-ID': 'Indonesian',
          'tl-PH': 'Tagalog',
          'ta-IN': 'Tamil',
          'en-US': 'English'
        };
        
        const langName = languageNames[opts.language] || opts.language;
        
        // Try to use any available voice as fallback
        if (availableVoices.length > 0) {
          utterance.voice = availableVoices[0];
          console.log('[VoiceOutput] Using fallback voice:', availableVoices[0].name);
          // Show warning that we're using fallback
          setMissingVoiceWarning(`No ${langName} voice installed. Using default voice.`);
        } else {
          // No voices available at all
          setMissingVoiceWarning(`No ${langName} voice installed. Voice output may not work.`);
        }
      }
    }

    // Set speech parameters
    utterance.rate = opts.rate ?? 1;
    utterance.pitch = opts.pitch ?? 1;
    utterance.volume = opts.volume ?? 1;

    utterance.onstart = () => {
      console.log('[VoiceOutput] Started speaking');
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      console.log('[VoiceOutput] Finished speaking');
      setIsSpeaking(false);
      // Only clear warning if speech completed successfully
      // Keep warning visible if it was set due to missing voice pack
    };

    utterance.onerror = (event) => {
      console.error('[VoiceOutput] Speech error:', event.error);
      setIsSpeaking(false);
      
      if (event.error === 'not-allowed') {
        setMissingVoiceWarning('Voice output blocked. Please allow audio in browser settings.');
      } else if (event.error === 'network') {
        setMissingVoiceWarning('Network error. Please check your connection.');
      } else if (event.error === 'synthesis-failed') {
        setMissingVoiceWarning('Voice output failed. Try installing language voice pack.');
      }
      // Don't show warning for 'canceled' error (user stopped it)
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported, options, availableVoices]);

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      // Clear warning when user manually stops (not an error)
      setMissingVoiceWarning(null);
    }
  }, [isSupported]);

  const pause = useCallback(() => {
    if (isSupported && isSpeaking) {
      window.speechSynthesis.pause();
    }
  }, [isSupported, isSpeaking]);

  const resume = useCallback(() => {
    if (isSupported && !isSpeaking) {
      window.speechSynthesis.resume();
    }
  }, [isSupported, isSpeaking]);

  return {
    isSupported,
    isSpeaking,
    availableVoices,
    missingVoiceWarning,
    speak,
    stop,
    pause,
    resume
  };
}
