// src/navigation.ts

import {createNavigation} from 'next-intl/navigation';

export const locales = ['en', 'ru', 'he'] as const;
export const localePrefix = 'always'; // <-- CHANGE THIS

export const {Link, redirect, usePathname, useRouter} = createNavigation({
  locales,
  localePrefix,
});