import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import { PARENTS_MEDITATION_TRACKS } from '../../../parentsContent';

export const runtime = 'nodejs';

const AUDIO_MIME_TYPE = 'audio/mpeg';
const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

function getTrackFileName(trackId: string) {
  return PARENTS_MEDITATION_TRACKS.find(track => track.id === trackId)?.fileName ?? null;
}

function parseAudioRange(rangeHeader: string | null, fileSize: number) {
  if (!rangeHeader) {
    return null;
  }

  const rangeMatch = RANGE_PATTERN.exec(rangeHeader);

  if (!rangeMatch) {
    return null;
  }

  const [, rawStart, rawEnd] = rangeMatch;

  if (!rawStart && rawEnd) {
    const suffixLength = Number(rawEnd);

    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }

    return {
      start: Math.max(fileSize - suffixLength, 0),
      end: fileSize - 1,
    };
  }

  const start = rawStart ? Number(rawStart) : 0;
  const end = rawEnd ? Number(rawEnd) : fileSize - 1;

  if (
    !Number.isInteger(start)
    || !Number.isInteger(end)
    || start < 0
    || end < start
    || start >= fileSize
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
}

function createAudioResponse(filePath: string, start: number, end: number, fileSize: number) {
  const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as unknown as BodyInit;
  const contentLength = end - start + 1;
  const status = start === 0 && end === fileSize - 1 ? 200 : 206;
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Content-Length': String(contentLength),
    'Content-Type': AUDIO_MIME_TYPE,
  });

  if (status === 206) {
    headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
  }

  return new Response(stream, {
    status,
    headers,
  });
}

export async function GET(request: NextRequest) {
  const trackId = request.nextUrl.searchParams.get('id') ?? '';
  const fileName = getTrackFileName(trackId);

  if (!fileName) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 });
  }

  const filePath = path.join(
    process.cwd(),
    'public',
    'audio',
    'meditations',
    fileName,
  );
  const fileStats = await stat(filePath).catch(() => null);

  if (!fileStats?.isFile()) {
    return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
  }

  const range = parseAudioRange(request.headers.get('range'), fileStats.size);

  if (request.headers.has('range') && !range) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        'Content-Range': `bytes */${fileStats.size}`,
      },
    });
  }

  return createAudioResponse(
    filePath,
    range?.start ?? 0,
    range?.end ?? fileStats.size - 1,
    fileStats.size,
  );
}
