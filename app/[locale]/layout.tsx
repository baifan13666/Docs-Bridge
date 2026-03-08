import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/src/i18n/routing";
import ThemeProvider from "@/components/providers/ThemeProvider";
import { FontSizeProvider } from "@/components/providers/FontSizeProvider";
import { Toaster } from "sonner";
import "../globals.css";
import "../scrollbar.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "DocsBridge — AI-powered Government Document Search",
    description:
        "Search and understand government policies across Southeast Asia in your preferred language. Supports English, Malay, Chinese, Tamil, Tagalog, and Indonesian.",
};

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    // Validate that the incoming locale is supported
    if (!hasLocale(routing.locales, locale)) {
        notFound();
    }

    // Load messages for the current locale
    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
            >
                <ThemeProvider>
                    <FontSizeProvider>
                        <NextIntlClientProvider locale={locale} messages={messages}>
                            {children}
                        </NextIntlClientProvider>
                    </FontSizeProvider>
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
