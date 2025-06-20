import { NextIntlClientProvider, useMessages } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function LocaleLayout({
  children,
  params: { lang },
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  // Pass the locale to getMessages() explicitly.
  // This resolves the error where the config couldn't be found.
  const messages = await getMessages({ locale: lang });

  return (
    // The provider also needs the locale to be passed.
    <NextIntlClientProvider locale={lang} messages={messages}>
      <div className="bg-gray-100 min-h-screen">{children}</div>
    </NextIntlClientProvider>
  );
}