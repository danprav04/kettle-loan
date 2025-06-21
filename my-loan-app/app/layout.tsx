import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import "./globals.css";
import messages from '@/locales/en.json'; // Directly import English messages

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Loan Tracker",
  description: "A simple app to track loans with friends",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = 'en'; // Hardcode the application to English

  return (
    <html lang={lang}>
      <body className={inter.className}>
        {/*
          Wrap the application in the NextIntlClientProvider with the hardcoded 'en' locale
          and its corresponding messages. This makes the translation functions (useTranslations)
          work throughout the app without needing URL-based locale detection, effectively
          disabling the multi-language feature while preserving the code.
          This also resolves the "notFound() is not allowed to use in root layout" error
          by avoiding the getMessages function which relies on URL-based locale detection.
        */}
        <NextIntlClientProvider locale={lang} messages={messages}>
          <div className="bg-gray-100 min-h-screen">{children}</div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}