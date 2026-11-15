import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type ManifestIcon = { src: string; sizes: string; type: string; purpose?: string };
type Manifest = {
  name: string;
  short_name: string;
  display: string;
  start_url: string;
  scope: string;
  orientation: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
};

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(root, 'public', 'manifest.webmanifest'), 'utf8'),
) as Manifest;
const html = readFileSync(join(root, 'index.html'), 'utf8');

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function readPngSize(relPath: string): { width: number; height: number } {
  const buf = readFileSync(join(root, 'public', relPath));
  expect([...buf.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function isRelative(url: string): boolean {
  return !/^([a-z][a-z0-9+.-]*:|\/)/i.test(url);
}

describe('web app manifest', () => {
  it('has name and a short_name of at most 12 characters', () => {
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(manifest.short_name.length).toBeGreaterThan(0);
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it('uses standalone display and portrait orientation', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('portrait');
  });

  it('uses relative start_url and scope', () => {
    expect(isRelative(manifest.start_url)).toBe(true);
    expect(isRelative(manifest.scope)).toBe(true);
  });

  it('uses six-digit hex theme and background colors', () => {
    expect(manifest.theme_color).toMatch(HEX_COLOR);
    expect(manifest.background_color).toMatch(HEX_COLOR);
  });

  it('declares 192, 512 and 512 maskable PNG icons', () => {
    expect(manifest.icons).toHaveLength(3);
    const summary = manifest.icons.map((i) => [i.sizes, i.type, i.purpose ?? 'any']);
    expect(summary).toEqual([
      ['192x192', 'image/png', 'any'],
      ['512x512', 'image/png', 'any'],
      ['512x512', 'image/png', 'maskable'],
    ]);
  });

  it.each([0, 1, 2])('icon %i file is a PNG matching its declared size', (index) => {
    const icon = manifest.icons[index];
    expect(isRelative(icon.src)).toBe(true);
    const [w, h] = icon.sizes.split('x').map(Number);
    expect(readPngSize(icon.src)).toEqual({ width: w, height: h });
  });
});

describe('index.html', () => {
  it('theme-color matches the manifest theme_color', () => {
    const match = /<meta\s+name="theme-color"\s+content="([^"]+)"/i.exec(html);
    expect(match?.[1]).toBe(manifest.theme_color);
  });

  it('links the manifest', () => {
    expect(html).toMatch(/<link\s+rel="manifest"\s+href="[^"]*manifest\.webmanifest"/i);
  });

  it('links an apple-touch-icon that is a 180x180 PNG', () => {
    const match = /<link\s+rel="apple-touch-icon"\s+href="([^"]+)"/i.exec(html);
    expect(match).not.toBeNull();
    const rel = match![1].replace('%BASE_URL%', '');
    expect(readPngSize(rel)).toEqual({ width: 180, height: 180 });
  });
});
