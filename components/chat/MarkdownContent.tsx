'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { ComponentPropsWithoutRef } from 'react';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export default function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // Custom link component using Next.js Link
        a: ({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) => {
          // Check if it's an external link
          const isExternal = href?.startsWith('http://') || href?.startsWith('https://');
          
          if (isExternal) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--color-accent) hover:underline"
                {...props}
              >
                {children}
              </a>
            );
          }
          
          // Internal link
          return (
            <Link
              href={href || '#'}
              className="text-(--color-accent) hover:underline"
            >
              {children}
            </Link>
          );
        },
        // Style other markdown elements
        p: ({ children, ...props }) => (
          <p className="mb-3 last:mb-0" {...props}>{children}</p>
        ),
        h1: ({ children, ...props }) => (
          <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0" {...props}>{children}</h1>
        ),
        h2: ({ children, ...props }) => (
          <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0" {...props}>{children}</h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0" {...props}>{children}</h3>
        ),
        h4: ({ children, ...props }) => (
          <h4 className="text-base font-semibold mb-2 mt-3 first:mt-0" {...props}>{children}</h4>
        ),
        ul: ({ children, ...props }) => (
          <ul className="list-disc list-inside mb-3 space-y-1" {...props}>{children}</ul>
        ),
        ol: ({ children, ...props }) => (
          <ol className="list-decimal list-inside mb-3 space-y-1" {...props}>{children}</ol>
        ),
        li: ({ children, ...props }) => (
          <li className="ml-4" {...props}>{children}</li>
        ),
        blockquote: ({ children, ...props }) => (
          <blockquote className="border-l-4 border-(--color-accent) pl-4 italic my-3 text-(--color-text-secondary)" {...props}>
            {children}
          </blockquote>
        ),
        code: ({ inline, children, ...props }: any) => {
          if (inline) {
            return (
              <code className="bg-(--color-bg-secondary) px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                {children}
              </code>
            );
          }
          return (
            <code className="block bg-(--color-bg-secondary) p-3 rounded-lg my-3 overflow-x-auto font-mono text-sm" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children, ...props }) => (
          <pre className="bg-(--color-bg-secondary) p-3 rounded-lg my-3 overflow-x-auto" {...props}>
            {children}
          </pre>
        ),
        table: ({ children, ...props }) => (
          <div className="overflow-x-auto my-3">
            <table className="min-w-full border border-(--color-border)" {...props}>
              {children}
            </table>
          </div>
        ),
        thead: ({ children, ...props }) => (
          <thead className="bg-(--color-bg-secondary)" {...props}>{children}</thead>
        ),
        th: ({ children, ...props }) => (
          <th className="border border-(--color-border) px-3 py-2 text-left font-semibold" {...props}>
            {children}
          </th>
        ),
        td: ({ children, ...props }) => (
          <td className="border border-(--color-border) px-3 py-2" {...props}>{children}</td>
        ),
        hr: (props) => (
          <hr className="my-4 border-(--color-border)" {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
