// FILE: app/[lang]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { ReactNode } from 'react';
import { notFound } from 'next/navigation';

// Define supported locales. This should align with your i18n.ts and middleware.ts configurations.
const supportedLocales = ['en', 'he', 'ru'];

export default async function LocaleLayout({
  children,
  params, // params is now a Promise
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>; // Type annotation for params updated to Promise
}) {
  // In Next.js 15+, params is a Promise and must be awaited before accessing its properties.
  const resolvedParams = await params;
  const lang = resolvedParams.lang;

  // Validate the 'lang' parameter after awaiting and resolving params.
  if (!supportedLocales.includes(lang)) {
    console.warn(`LocaleLayout: Unsupported locale "${lang}" received from resolved params. Triggering notFound().`);
    notFound();
    // notFound() should abort rendering, but return null for type safety and as a fallback.
    return null;
  }

  let messages;
  try {
    // Attempt to fetch internationalization messages for the given language.
    messages = await getMessages({ locale: lang });
  } catch (error) {
    // Log any errors encountered during message fetching.
    console.error(`LocaleLayout: Error fetching messages for locale "${lang}":`, error);
    // If this error persists ("Couldn't find next-intl config file"),
    // it might be an issue beyond just params resolution, potentially related to
    // next-intl's interaction with Turbopack or path resolution for message files.
    notFound(); // If messages can't be loaded, treat as a page not found.
    return null;
  }
  
  // Ensure that 'messages' is a valid object before passing to the provider.
  if (typeof messages !== 'object' || messages === null) {
      console.error(`LocaleLayout: Messages for locale "${lang}" are not a valid object. This may indicate an issue with the i18n setup or message files.`);
      notFound();
      return null;
  }

  // Provide the locale and messages to client components via NextIntlClientProvider.
  return (
    <NextIntlClientProvider locale={lang} messages={messages}>
      <div className="bg-gray-100 min-h-screen">{children}</div>
    </NextIntlClientProvider>
  );
}