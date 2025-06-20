import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'he', 'ru'],
  defaultLocale: 'en'
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};