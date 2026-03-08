// Root layout — the locale-specific layout at app/[locale]/layout.tsx
// handles <html>, <body>, and i18n provider. This root layout is a
// simple pass-through required by Next.js.

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
