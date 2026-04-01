import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function buildCSPHeader(isDevelopment: boolean): string {
  const scriptSrc = isDevelopment
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com`
    : `script-src 'self' 'unsafe-inline' https://apis.google.com https://www.gstatic.com`;

  const styleSrc = "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com";

  const directives = [
    'default-src \'self\'',
    scriptSrc,
    styleSrc,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    'worker-src \'self\' blob:',
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://api.openai.com https://api.anthropic.com https://api.deepseek.com https://api.mistral.ai https://www.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://*.firebaseapp.com https://apis.google.com https://checkout.stripe.com https://api.stripe.com https://*.ingest.us.sentry.io https://eh-universe.com https://*.vercel.app",
    "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
  ];

  return directives.join('; ');
}

export function proxy(_request: NextRequest) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const cspHeader = buildCSPHeader(isDevelopment);
  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|icon|apple-icon|manifest\\.webmanifest|images/|api/).*)',
  ],
};
