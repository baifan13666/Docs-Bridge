'use client';

import Tooltip from '../ui/Tooltip';
import type { SimplificationResult } from '@/lib/api/nlp';

interface DifficultWordsTextProps {
  text: string;
  difficultWords: SimplificationResult['difficult_words'];
  className?: string;
}

export default function DifficultWordsText({ 
  text, 
  difficultWords, 
  className = '' 
}: DifficultWordsTextProps) {
  if (!difficultWords || difficultWords.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Create a map of word positions for efficient lookup
  const wordMap = new Map<string, SimplificationResult['difficult_words'][0]>();
  difficultWords.forEach(item => {
    wordMap.set(item.word.toLowerCase(), item);
  });

  // Split text into words while preserving whitespace and punctuation
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  
  // Regex to match words (including contractions and hyphens)
  const wordRegex = /\b[\w'-]+\b/g;
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0];
    const wordStart = match.index;
    const wordEnd = wordStart + word.length;

    // Add text before this word
    if (wordStart > currentIndex) {
      parts.push(text.substring(currentIndex, wordStart));
    }

    // Check if this word is in our difficult words list
    const wordLower = word.toLowerCase();
    const difficultWord = wordMap.get(wordLower);

    if (difficultWord) {
      // This is a difficult word - add tooltip
      parts.push(
        <Tooltip
          key={`word-${wordStart}`}
          content={
            <div className="space-y-1">
              <div>
                <strong className="font-semibold">{difficultWord.word}</strong>
              </div>
              <div className="text-gray-200 dark:text-gray-300">
                {difficultWord.explanation}
              </div>
              {difficultWord.simpler_alternative && (
                <div className="text-green-300 dark:text-green-400 mt-1">
                  Simpler: "{difficultWord.simpler_alternative}"
                </div>
              )}
            </div>
          }
          className="underline decoration-dashed decoration-1 underline-offset-2 cursor-help text-(--color-accent) hover:text-(--color-accent-hover) transition-colors"
        >
          {word}
        </Tooltip>
      );
    } else {
      // Regular word
      parts.push(word);
    }

    currentIndex = wordEnd;
  }

  // Add any remaining text
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  return <span className={className}>{parts}</span>;
}
