// Node only. Used from vite.config.ts, never bundled into the app.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import type { Plugin } from 'vite';
import { computeBuildVersion } from './buildVersion';
import type { BuildFile } from './buildVersion';
import { cachePrefix } from './cacheNames';

const SW_FILE_NAME = 'sw.js';
const SW_ENTRY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'sw.ts');

async function listFiles(dir: string, relativeDir = ''): Promise<string[]> {
  const entries = await readdir(path.join(dir, relativeDir), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listFiles(dir, relativePath) : [relativePath];
    }),
  );
  return nested.flat();
}

async function readBuildFiles(outDir: string): Promise<BuildFile[]> {
  const paths = (await listFiles(outDir)).filter((p) => p !== SW_FILE_NAME);
  return Promise.all(
    paths.map(async (p) => ({ path: p, content: await readFile(path.join(outDir, p)) })),
  );
}

export function swPlugin(options: { repoName: string }): Plugin {
  let outDir = '';
  let building = false;

  return {
    name: 'pwa-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      // The nested build uses configFile: false, so this plugin is not loaded
      // there. The flag is a second guard against recursion.
      if (building) return;
      building = true;
      try {
        const files = await readBuildFiles(outDir);
        const version = computeBuildVersion(files);
        const precacheUrls = ['./', ...files.map((f) => f.path)];

        await build({
          configFile: false,
          publicDir: false,
          logLevel: 'warn',
          define: {
            __PRECACHE_URLS__: JSON.stringify(precacheUrls),
            __CACHE_PREFIX__: JSON.stringify(cachePrefix(options.repoName)),
            __CACHE_VERSION__: JSON.stringify(version),
          },
          build: {
            outDir,
            emptyOutDir: false,
            copyPublicDir: false,
            sourcemap: false,
            minify: true,
            lib: {
              entry: SW_ENTRY,
              formats: ['iife'],
              name: 'MoneyManagerServiceWorker',
              fileName: () => SW_FILE_NAME,
            },
          },
        });
      } finally {
        building = false;
      }
    },
  };
}
