import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(import.meta.dirname, '..');
const parentsContentPath = path.join(projectRoot, 'app', 'parents', 'parentsContent.ts');

const expectedTracks = [
  'day.mp3',
  'good-sleep.mp3',
  'inner-child.mp3',
  'evening.mp3',
  'morning.mp3',
];

test('медитации используют доступные статические аудиофайлы', async () => {
  const parentsContent = await readFile(parentsContentPath, 'utf8');

  for (const fileName of expectedTracks) {
    const publicSource = `/audio/meditations/${fileName}`;
    const publicFilePath = path.join(
      projectRoot,
      'public',
      'audio',
      'meditations',
      fileName,
    );

    assert.match(
      parentsContent,
      new RegExp(`source: ['"]${publicSource.replaceAll('/', '\\/')}['"]`),
      `Для ${fileName} должен использоваться статический URL ${publicSource}`,
    );
    await access(publicFilePath);
  }

  assert.doesNotMatch(
    parentsContent,
    /\/parents\/trance\/music\/track/,
    'Плеер медитаций не должен зависеть от серверного Route Handler',
  );
});
