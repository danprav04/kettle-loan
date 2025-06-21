import {createLocalizedPathnamesNavigation} from 'next-intl/navigation';
 
export const locales = ['en', 'ru', 'he'] as const;
export const localePrefix = 'as-needed';

// Define pathnames for each locale if needed
const pathnames = {
  '/': '/',
  // Add more pathnames as needed
};
 
export const {Link, redirect, usePathname, useRouter} = createLocalizedPathnamesNavigation({
  locales, 
  localePrefix,
  pathnames
});