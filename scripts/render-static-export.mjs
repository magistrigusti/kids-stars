import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const nextDir = path.join(rootDir, '.next');
const publicDir = path.join(rootDir, 'public');
const appServerDir = path.join(nextDir, 'server', 'app');
const nextStaticDir = path.join(nextDir, 'static');
const outDir = path.join(rootDir, 'out');

const staticExtensions = new Set([
  '.css',
  '.html',
  '.ico',
  '.jpg',
  '.jpeg',
  '.png',
  '.rsc',
  '.svg',
  '.txt',
  '.webmanifest',
  '.webp',
  '.xml',
]);

async function pathExists(filePath) {
  return stat(filePath)
    .then(() => true)
    .catch(() => false);
}

async function copyIfExists(source, target) {
  if (!(await pathExists(source))) {
    return;
  }

  await cp(source, target, {
    recursive: true,
    force: true,
  });
}

async function writeCleanRouteHtml(source, relativePath) {
  if (!relativePath.endsWith('.html')) {
    return;
  }

  const cleanRoutePath = relativePath === 'index.html'
    ? 'index.html'
    : relativePath.replace(/\.html$/, `${path.sep}index.html`);

  const target = path.join(outDir, cleanRoutePath);

  if (target === path.join(outDir, relativePath)) {
    return;
  }

  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target, { force: true });
}

async function copyStaticAppFiles(currentDir) {
  if (!(await pathExists(currentDir))) {
    return;
  }

  const relativeDir = path.relative(appServerDir, currentDir);

  if (relativeDir === 'api' || relativeDir.startsWith(`api${path.sep}`)) {
    return;
  }

  const entries = await readdir(currentDir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const source = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await copyStaticAppFiles(source);
        return;
      }

      const extension = path.extname(entry.name);

      if (!staticExtensions.has(extension)) {
        return;
      }

      const relativePath = path.relative(appServerDir, source);
      const target = path.join(outDir, relativePath);

      await mkdir(path.dirname(target), { recursive: true });
      await cp(source, target, { force: true });
      await writeCleanRouteHtml(source, relativePath);
    }),
  );
}

await rm(outDir, {
  recursive: true,
  force: true,
});
await mkdir(outDir, { recursive: true });

await copyIfExists(publicDir, outDir);
await copyIfExists(nextStaticDir, path.join(outDir, '_next', 'static'));
await copyStaticAppFiles(appServerDir);

console.log('Render static export ready: out');
