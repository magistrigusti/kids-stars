import { NextRequest, NextResponse } from 'next/server';
import {
  createKingStarsPortalSession,
  KINGSTARS_PORTAL_SESSION_COOKIE,
  verifyPortalSsoTicket,
} from '@/lib/network/portalSession';
import { syncPortalNetworkUser } from '@/lib/network/users';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const ticket = request.nextUrl.searchParams.get('ticket') ?? '';
    const portalUser = verifyPortalSsoTicket(ticket);

    if (!portalUser) {
      return NextResponse.redirect(new URL('/login?portal=failed', request.url));
    }

    try {
      await syncPortalNetworkUser(portalUser);
    } catch (error) {
      console.error('Portal user sync failed:', error);
    }

    const response = NextResponse.redirect(new URL('/training/brain', request.url));
    response.cookies.set(
      KINGSTARS_PORTAL_SESSION_COOKIE,
      createKingStarsPortalSession(portalUser),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      },
    );

    return response;
  } catch (error) {
    console.error('Portal callback failed:', error);
    return NextResponse.redirect(new URL('/login?portal=callback_failed', request.url));
  }
}
