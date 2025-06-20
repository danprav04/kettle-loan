import {getRequestConfig} from 'next-intl/server';
import {notFound} from 'next/navigation';
 
const locales = ['en', 'he', 'ru'];
 
export default getRequestConfig(async ({locale}) => {
  // This is a robust check that handles two cases:
  // 1. `locale` is undefined.
  // 2. `locale` is a string but not one of our supported locales.
  // In either case, we stop rendering and show a 404 page.
  if (!locale || !locales.includes(locale)) {
    notFound();
  }
 
  // Because the only way to get past the check above is for `locale`
  // to be a valid string that exists in our `locales` array,
  // TypeScript now correctly understands that `locale` is of type `string`.
  return {
    locale,
    messages: (await import(`./locales/${locale}.json`)).default
  };
});