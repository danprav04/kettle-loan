// src/components/IntlProvider.tsx
"use client";

import { NextIntlClientProvider } from "next-intl";
import { ReactNode, useEffect, useState } from "react";

// Import all message files directly
import enMessages from '../../messages/en.json';
import heMessages from '../../messages/he.json';
import ruMessages from '../../messages/ru.json';

const messages = {
  en: enMessages,
  he: heMessages,
  ru: ruMessages,
};

type Messages = typeof enMessages;

export default function IntlProvider({ children }: { children: ReactNode }) {
  // Default to 'en' and load from local storage on the client
  const [locale, setLocale] = useState('en');
  const [loadedMessages, setLoadedMessages] = useState<Messages>(messages.en);

  useEffect(() => {
    const storedLocale = localStorage.getItem('locale') || 'en';
    if (messages[storedLocale as keyof typeof messages]) {
      setLocale(storedLocale);
      setLoadedMessages(messages[storedLocale as keyof typeof messages]);
    }
  }, []);

  return (
    <NextIntlClientProvider locale={locale} messages={loadedMessages}>
      {children}
    </NextIntlClientProvider>
  );
}