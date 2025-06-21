import createMiddleware from 'next-intl/middleware';
import { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['en', 'ru', 'he'],
  defaultLocale: 'en',
  localePrefix: 'always'
});

export default function(request: NextRequest) {
  console.log(`[Middleware] Intercepting request for path: ${request.nextUrl.pathname}`);
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};