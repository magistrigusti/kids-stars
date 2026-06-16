import { NextRequest, NextResponse } from 'next/server';
import {
  createKingStarsPortalSession,
  KINGSTARS_PORTAL_SESSION_COOKIE,
  type KingStarsPortalUser,
} from '@/lib/network/portalSession';
import { completeTelegramOidcLogin } from '@/lib/network/telegramOidc';
import { syncTelegramNetworkUser } from '@/lib/network/users';

export const runtime = 'nodejs';

const TELEGRAM_STATE_COOKIE = 'kingstars_telegram_state';
const TELEGRAM_NONCE_COOKIE = 'kingstars_telegram_nonce';
const TELEGRAM_VERIFIER_COOKIE = 'kingstars_telegram_code_verifier';

function clearTelegramLoginCookies(response: NextResponse): void {
  response.cookies.delete(TELEGRAM_STATE_COOKIE);
  response.cookies.delete(TELEGRAM_NONCE_COOKIE);
  response.cookies.delete(TELEGRAM_VERIFIER_COOKIE);
}

function splitTelegramName(name: string): {
  firstName: string;
  lastName: string | null;
} {
  const [firstName, ...lastNameParts] = name.trim().split(/\s+/);

  return {
    firstName: firstName || name,
    lastName: lastNameParts.join(' ') || null,
  };
}

function redirectWithCleanCookies(request: NextRequest, path: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, request.url));

  clearTelegramLoginCookies(response);

  return response;
}

export async function GET(request: NextRequest) {
  try {
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      return redirectWithCleanCookies(request, '/login?telegram=failed');
    }

    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const expectedState = request.cookies.get(TELEGRAM_STATE_COOKIE)?.value;
    const nonce = request.cookies.get(TELEGRAM_NONCE_COOKIE)?.value;
    const codeVerifier = request.cookies.get(TELEGRAM_VERIFIER_COOKIE)?.value;

    if (!code || !state || !expectedState || state !== expectedState || !nonce || !codeVerifier) {
      return redirectWithCleanCookies(request, '/login?telegram=failed');
    }

    const telegramUser = await completeTelegramOidcLogin({
      code,
      nonce,
      codeVerifier,
      origin: request.nextUrl.origin,
    });
    const nameParts = splitTelegramName(telegramUser.name);

    await syncTelegramNetworkUser({
      id: telegramUser.id,
      username: telegramUser.username,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      photoUrl: telegramUser.picture,
      phoneNumber: telegramUser.phoneNumber,
    });

    const sessionUser: KingStarsPortalUser = {
      userId: telegramUser.id,
      username: telegramUser.username,
      name: telegramUser.name,
      imageUrl: telegramUser.picture,
      emailAddress: null,
      authProvider: 'telegram',
      source: 'telegram',
    };
    const response = NextResponse.redirect(new URL('/training/brain', request.url));

    response.cookies.set(
      KINGSTARS_PORTAL_SESSION_COOKIE,
      createKingStarsPortalSession(sessionUser),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      },
    );
    clearTelegramLoginCookies(response);

    return response;
  } catch (error) {
    console.error('Telegram OIDC login failed:', error);

    return redirectWithCleanCookies(request, '/login?telegram=callback_failed');
  }
}
