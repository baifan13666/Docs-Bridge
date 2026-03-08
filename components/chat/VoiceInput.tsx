'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  language?: string; // BCP 47 language code (e.g., 'en-US', 'ms-MY', 'tl-PH')
}

export default function VoiceInput({ onTranscript, disabled = false, language = 'en-US' }: VoiceInputProps) {
  const t = useTranslations();
  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>(''); // Store latest transcript

  useEffect(() => {
    // Check if Web Speech API is supported
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = language;

        recognition.onstart = () => {
          console.log('[VoiceInput] Recording started');
          setIsRecording(true);
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptPart = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcriptPart;
            } else {
              interimTranscript += transcriptPart;
            }
          }

          // Update display transcript and ref
          const currentTranscript = finalTranscript || interimTranscript;
          setTranscript(currentTranscript);
          transcriptRef.current = currentTranscript;

          // Send final transcript immediately
          if (finalTranscript) {
            console.log('[VoiceInput] Final transcript:', finalTranscript);
            onTranscript(finalTranscript);
            setIsRecording(false);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('[VoiceInput] Recognition error:', event.error);
          setIsRecording(false);
          setTranscript('');
          transcriptRef.current = '';
          
          // Handle specific errors
          if (event.error === 'no-speech') {
            console.log('[VoiceInput] No speech detected');
            alert('No speech detected. Please try again.');
          } else if (event.error === 'not-allowed') {
            alert('Microphone access denied. Please allow microphone access in your browser settings.');
          } else if (event.error === 'network') {
            alert('Network error. Please check your internet connection.');
          }
        };

        recognition.onend = () => {
          console.log('[VoiceInput] Recording ended');
          console.log('[VoiceInput] Final transcript on end:', transcriptRef.current);
          
          // If we have a transcript when recording ends, send it
          if (transcriptRef.current && transcriptRef.current.trim()) {
            console.log('[VoiceInput] Sending transcript on end:', transcriptRef.current);
            onTranscript(transcriptRef.current);
          }
          
          setIsRecording(false);
          setTranscript('');
          transcriptRef.current = '';
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language, onTranscript]);

  const startRecording = () => {
    if (recognitionRef.current && !isRecording) {
      setTranscript('');
      transcriptRef.current = '';
      recognitionRef.current.start();
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
  };

  if (!isSupported) {
    return null; // Hide button if not supported
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled}
        aria-label={isRecording ? t('chat.stopRecording') : t('chat.useVoice')}
        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
          isRecording
            ? 'text-red-500 bg-red-50 dark:bg-red-900/20 animate-pulse'
            : 'text-(--color-text-secondary) hover:text-(--color-accent) hover:bg-(--color-bg-tertiary)'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="material-symbols-outlined text-[20px]">
          {isRecording ? 'stop_circle' : 'mic'}
        </span>
      </button>

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-(--color-bg-secondary) border border-(--color-border) rounded-lg px-3 py-2 shadow-lg whitespace-nowrap z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-(--color-text-primary) font-medium">
              {transcript || t('chat.listening')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
