import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { toBasePath } from './src/pwa/basePath';
import { REPO_NAME } from './src/pwa/repoName';
import { swPlugin } from './src/pwa/swPlugin';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? toBasePath(REPO_NAME) : '/',
  plugins: [react(), swPlugin({ repoName: REPO_NAME })],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
