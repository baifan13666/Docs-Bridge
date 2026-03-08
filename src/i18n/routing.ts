import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // Supported locales from requirement.md:
  // English, Malay, Chinese, Tamil, Tagalog, Indonesian
  locales: ['en', 'ms', 'zh', 'ta', 'tl', 'id'],
  defaultLocale: 'en',

  // Only show locale prefix for non-default locales
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
