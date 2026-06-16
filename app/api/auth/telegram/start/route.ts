import { NextRequest, NextResponse } from 'next/server';
import { createTelegramOidcSession } from '@/lib/network/telegramOidc';

export const runtime = 'nodejs';

const TELEGRAM_STATE_COOKIE = 'kingstars_telegram_state';
const TELEGRAM_NONCE_COOKIE = 'kingstars_telegram_nonce';
const TELEGRAM_VERIFIER_COOKIE = 'kingstars_telegram_code_verifier';
const TELEGRAM_LOGIN_COOKIE_MAX_AGE = 60 * 10;

function setTelegramLoginCookie(
  response: NextResponse,
  name: string,
  value: string,
): void {
  response.cookies.set(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TELEGRAM_LOGIN_COOKIE_MAX_AGE,
  });
}

export function GET(request: NextRequest) {
  try {
    const session = createTelegramOidcSession(request.nextUrl.origin);
    const response = NextResponse.redirect(session.authorizationUrl);

    setTelegramLoginCookie(response, TELEGRAM_STATE_COOKIE, session.state);
    setTelegramLoginCookie(response, TELEGRAM_NONCE_COOKIE, session.nonce);
    setTelegramLoginCookie(response, TELEGRAM_VERIFIER_COOKIE, session.codeVerifier);

    return response;
  } catch (error) {
    console.error('Telegram OIDC start failed:', error);

    return NextResponse.redirect(new URL('/login?telegram=not_configured', request.url));
  }
}
