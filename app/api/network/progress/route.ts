import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getKingStarsPortalSession } from '@/lib/network/portalSession';
import { syncKingStarsNetworkUser } from '@/lib/network/users';
import {
  getStoredTrainingProgress,
  saveStoredTrainingProgress,
} from '@/lib/network/trainingProgressStore';
import { sanitizeTrainingProgress } from '@/lib/network/trainingProgress';

export const runtime = 'nodejs';

export async function GET() {
  const user = await currentUser();
  const portalUser = await getKingStarsPortalSession();
  const profile = await syncKingStarsNetworkUser({
    clerkUser: user,
    portalUser,
  });

  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const progress = await getStoredTrainingProgress(
    profile.networkUserId,
    profile.legacyUserIds,
  );

  return NextResponse.json({ progress });
}

async function saveProgressRequest(request: Request) {
  const user = await currentUser();
  const portalUser = await getKingStarsPortalSession();
  const profile = await syncKingStarsNetworkUser({
    clerkUser: user,
    portalUser,
  });

  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const progress = sanitizeTrainingProgress(body?.progress ?? body);
  const savedProgress = await saveStoredTrainingProgress(
    profile.networkUserId,
    progress,
    profile.legacyUserIds,
  );

  return NextResponse.json({ progress: savedProgress });
}

export async function PUT(request: Request) {
  return saveProgressRequest(request);
}

export async function POST(request: Request) {
  return saveProgressRequest(request);
}
