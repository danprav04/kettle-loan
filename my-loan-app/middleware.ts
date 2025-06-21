import { NextRequest, NextResponse } from 'next/server';

// This middleware is simplified to disable internationalization routing.
// It no longer performs locale detection or path rewriting.
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // The matcher remains to apply this middleware to all paths except for
  // specific asset and API routes.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};