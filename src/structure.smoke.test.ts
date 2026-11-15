import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FloatingActionButton } from './components/FloatingActionButton';
import { TabBar } from './components/TabBar';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const isSource = (f: string) => /\.(ts|tsx)$/.test(f);
const isTest = (f: string) => /\.test\.(ts|tsx)$/.test(f) || f.includes(`${sep}testing${sep}`);
const sourceFiles = walk(SRC).filter((f) => isSource(f) && !isTest(f));
const read = (f: string) => readFileSync(f, 'utf8');
const rel = (f: string) => relative(ROOT, f);

describe('package.json', () => {
  it('has exactly react, react-dom and idb as runtime dependencies', () => {
    const pkg = JSON.parse(read(join(ROOT, 'package.json'))) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['idb', 'react', 'react-dom']);
  });

  it('has no forbidden dev dependencies', () => {
    const pkg = JSON.parse(read(join(ROOT, 'package.json'))) as {
      devDependencies: Record<string, string>;
    };
    const forbidden = ['jsdom', '@testing-library/react', 'redux', 'zustand', 'react-router-dom'];
    for (const name of forbidden) expect(pkg.devDependencies).not.toHaveProperty(name);
  });
});

describe('source structure', () => {
  it('domain files import nothing from React, db, or the DOM', () => {
    const domain = sourceFiles.filter((f) => f.startsWith(join(SRC, 'domain') + sep));
    expect(domain.length).toBeGreaterThan(0);
    const bad = domain.filter((f) => {
      const specs = [...read(f).matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');
      return specs.some(
        (s) => s.startsWith('react') || /(^|\/)db(\/|$)/.test(s) || /(^|\/)(features|hooks|components)\//.test(s),
      );
    });
    expect(bad.map(rel)).toEqual([]);
    const domUse = domain.filter((f) => /\b(document|window|localStorage)\./.test(read(f)));
    expect(domUse.map(rel)).toEqual([]);
  });

  it('nothing outside src/db references indexedDB', () => {
    const offenders = sourceFiles
      .filter((f) => !f.startsWith(join(SRC, 'db') + sep))
      .filter((f) => /indexedDB/.test(read(f)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it('has no `any` type in src', () => {
    const pattern = /:\s*any\b|\bas\s+any\b|<any>|\bany\[\]|Array<any>|,\s*any\s*[>,)]/;
    const offenders = sourceFiles.filter((f) => pattern.test(read(f)));
    expect(offenders.map(rel)).toEqual([]);
  });
});

describe('navigation shell', () => {
  const tabs = [
    { id: 'accounts', label: 'Accounts' },
    { id: 'history', label: 'History' },
    { id: 'cashflow', label: 'Cash Flow' },
    { id: 'receipts', label: 'Receipts' },
  ];

  it('TabBar renders four tabs in order with the active one marked', () => {
    const html = renderToStaticMarkup(
      createElement(TabBar, { tabs, activeId: 'history', onSelect: () => undefined }),
    );
    const labels = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
    expect(labels).toEqual(['Accounts', 'History', 'Cash Flow', 'Receipts']);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('FloatingActionButton renders an accessible button', () => {
    const html = renderToStaticMarkup(
      createElement(FloatingActionButton, { label: 'Add transaction', onClick: () => undefined }),
    );
    expect(html).toContain('aria-label="Add transaction"');
  });

  it('App shows the FAB on every tab except Receipts', () => {
    const app = read(join(SRC, 'App.tsx'));
    expect(app).toMatch(/FAB_TABS[^=]*=\s*\['accounts',\s*'history',\s*'cashflow'\]/);
    expect(app).not.toMatch(/FAB_TABS[^;]*'receipts'/);
  });
});

describe('global styles', () => {
  const variables = read(join(SRC, 'styles', 'variables.css'));
  const base = read(join(SRC, 'styles', 'base.css'));

  it('defines a 44px tap size and the core CSS variables', () => {
    expect(variables).toMatch(/--tap-size:\s*44px/);
    for (const name of ['--color-focus', '--space-2', '--radius-md', '--font-size-md', '--card-padding']) {
      expect(variables).toContain(`${name}:`);
    }
  });

  it('applies the tap size to interactive elements', () => {
    expect(base).toMatch(/min-height:\s*var\(--tap-size\)/);
  });

  it('has a prefers-reduced-motion rule and a focus-visible style', () => {
    expect(base).toContain('@media (prefers-reduced-motion: reduce)');
    expect(base).toContain(':focus-visible');
  });

  it('has a 768px breakpoint using min-width', () => {
    expect(base).toContain('@media (min-width: 768px)');
  });
});
