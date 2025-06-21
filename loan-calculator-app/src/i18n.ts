import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';

const locales = ['en', 'ru', 'he'];

export default getRequestConfig(async ({ locale }) => {
  console.log('✅ i18n.ts: locale =', locale);

  if (!locales.includes(locale as any)) {
    console.error('❌ Invalid locale:', locale);
    notFound();
  }

  return {
    messages: (await import(`../messages/${locale}.json`)).default,
    locale, // ✅ important!
  };
});
