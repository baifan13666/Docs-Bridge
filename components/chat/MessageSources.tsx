'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

interface Source {
  chunk_id: string;
  document_id?: string;
  title: string;
  chunk_text: string;
  similarity: number;
  source_url?: string | null;
}

interface MessageSourcesProps {
  sources: Source[];
  isAuthenticated: boolean;
}

export default function MessageSources({ sources, isAuthenticated }: MessageSourcesProps) {
  const t = useTranslations('chatInterface');
  const router = useRouter();
  const pathname = usePathname();
  
  const getKnowledgeBasePath = () => {
    const segments = (pathname || '').split('/').filter(Boolean);
    if (segments.length === 0) return '/knowledge-base';
    const locale = segments[0];
    return `/${locale}/knowledge-base`;
  };

  if (!sources || sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 pt-4 border-t border-(--color-border)">
      <p className="text-xs font-semibold text-(--color-text-secondary) mb-2">
        {t('sources', { count: sources.length })}
      </p>
      <div className="space-y-2">
        {sources.map((source, idx) => (
          <div 
            key={source.chunk_id}
            onClick={() => {
              if (isAuthenticated && source.document_id) {
                router.push(`${getKnowledgeBasePath()}?doc=${source.document_id}`);
              }
            }}
            className={`text-xs bg-(--color-bg-secondary) p-2 rounded border border-(--color-border) transition-all ${
              isAuthenticated && source.document_id 
                ? 'cursor-pointer hover:bg-(--color-bg-tertiary) hover:border-(--color-accent) hover:shadow-md' 
                : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-medium text-(--color-accent)">
                {idx + 1}. {source.title}
              </span>
              <span className="text-(--color-text-secondary) shrink-0">
                {(source.similarity * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-(--color-text-secondary) text-[11px] mb-1">
              {source.chunk_text}
            </p>
            <div className="flex items-center justify-between gap-2">
              {source.source_url && (
                <a 
                  href={source.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-(--color-accent) hover:underline text-[10px] inline-block"
                >
                  {t('viewExternalSource')}
                </a>
              )}
              {isAuthenticated && source.document_id && (
                <span className="text-(--color-accent) text-[10px] font-medium">
                  {t('clickToViewInKB')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
