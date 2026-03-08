'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type FontSize = 'small' | 'medium' | 'large' | 'extra-large';

interface FontSizeContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

const fontSizeMap: Record<FontSize, string> = {
  'small': '14px',
  'medium': '16px',
  'large': '18px',
  'extra-large': '20px',
};

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');

  useEffect(() => {
    // Load font size from localStorage
    const stored = localStorage.getItem('docsbridge-font-size') as FontSize;
    if (stored && fontSizeMap[stored]) {
      setFontSizeState(stored);
      applyFontSize(stored);
    }
  }, []);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem('docsbridge-font-size', size);
    applyFontSize(size);
  };

  const applyFontSize = (size: FontSize) => {
    document.documentElement.style.setProperty('--base-font-size', fontSizeMap[size]);
  };

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (context === undefined) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
}
