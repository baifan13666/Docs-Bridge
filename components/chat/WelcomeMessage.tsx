'use client';

import { useTranslations } from 'next-intl';
import MarkdownContent from './MarkdownContent';

interface WelcomeMessageProps {
  isAuthenticated: boolean;
  onTopicClick: (topic: string) => void;
}

export default function WelcomeMessage({ isAuthenticated, onTopicClick }: WelcomeMessageProps) {
  const t = useTranslations();

  return (
    <div className="flex justify-start">
      <div className="shrink-0 mr-4">
        <div className="w-8 h-8 flex items-center justify-center mt-1 rounded p-1">
          <img src="/notextlogo.png" alt={t('common.appName')} className="w-full h-full object-contain" />
        </div>
      </div>
      <div className="max-w-[85%] sm:max-w-[80%]">
        <div className="text-(--color-text-primary) bg-(--color-message-ai-bg) p-5 rounded-2xl rounded-tl-sm shadow-sm border border-(--color-message-ai-border) chat-message">
          <MarkdownContent 
            content={`**${t('chat.welcome')}**\n\n${t('chat.welcomeDescription')}`}
          />
          {!isAuthenticated && (
            <p className="mb-4 text-sm text-(--color-text-secondary)">
              {t('chat.freeQueryRemaining')}
            </p>
          )}
          <p className="mb-4 text-sm text-(--color-text-secondary)">
            {t('chat.typeOrVoice')}
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              t('chat.topics.healthcare'),
              t('chat.topics.cashAid'),
              t('chat.topics.education'),
              t('chat.topics.housing')
            ].map((topic) => (
              <button
                key={topic}
                onClick={() => onTopicClick(topic)}
                className="px-3 py-1.5 bg-(--color-bg-secondary) text-(--color-accent) rounded-full text-sm hover:bg-(--color-bg-tertiary) transition-colors border border-(--color-border) shadow-sm font-medium cursor-pointer"
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
