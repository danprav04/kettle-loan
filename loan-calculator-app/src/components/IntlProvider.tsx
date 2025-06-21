// src/components/IntlProvider.tsx
"use client";

import { NextIntlClientProvider } from "next-intl";
import { ReactNode, useEffect, useState, createContext, useContext, Dispatch, SetStateAction } from "react";

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

// Create a context to share locale state and its setter
interface LocaleContextType {
  locale: string;
  setLocale: Dispatch<SetStateAction<string>>;
}
const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export default function IntlProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState('en'); // Default to 'en'
  const [loadedMessages, setLoadedMessages] = useState<Messages>(messages.en);

  // On initial client-side render, load the locale from localStorage
  useEffect(() => {
    const storedLocale = localStorage.getItem('locale') || 'en';
    if (messages[storedLocale as keyof typeof messages]) {
      setLocale(storedLocale);
    }
  }, []);

  // When locale changes, update messages, localStorage, and document attributes
  useEffect(() => {
    if (messages[locale as keyof typeof messages]) {
      setLoadedMessages(messages[locale as keyof typeof messages]);
      localStorage.setItem('locale', locale);
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr';
    }
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider
        locale={locale}
        messages={loadedMessages}
        timeZone="UTC" // Set a default timezone to prevent errors
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}

// Custom hook for components to easily access and change the locale
export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within an IntlProvider');
  }
  return context;
}