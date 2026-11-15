import fc from 'fast-check';
import { describe, it } from 'vitest';
import { computeBuildVersion, type BuildFile } from './buildVersion';

// Feature: pwa-github-pages, Property 2: Build version tracks content
// **Validates: Requirements 5.1, 11.1**
describe('Property 2: Build version tracks content', () => {
  const path = fc.stringMatching(/^[a-z0-9._-]{1,12}(\/[a-z0-9._-]{1,12}){0,2}$/);
  const content = fc.uint8Array({ maxLength: 32 });

  // Non-empty list of files with unique paths.
  const files = fc
    .uniqueArray(fc.record({ path, content }), {
      minLength: 1,
      maxLength: 8,
      selector: (f) => f.path,
    })
    .map((list): BuildFile[] => list);

  const runs = { numRuns: 100 };

  it('gives the same result for any ordering', () => {
    fc.assert(
      fc.property(files, fc.infiniteStream(fc.nat()), (list, rnd) => {
        const it = rnd[Symbol.iterator]();
        const shuffled = [...list];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = it.next().value % (i + 1);
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return computeBuildVersion(shuffled) === computeBuildVersion(list);
      }),
      runs,
    );
  });

  it('changes when one file content changes', () => {
    fc.assert(
      fc.property(files, fc.nat(), content, (list, idx, newContent) => {
        const i = idx % list.length;
        fc.pre(!Buffer.from(newContent).equals(Buffer.from(list[i].content)));
        const changed = list.map((f, k) => (k === i ? { ...f, content: newContent } : f));
        return computeBuildVersion(changed) !== computeBuildVersion(list);
      }),
      runs,
    );
  });

  it('changes when one file path changes', () => {
    fc.assert(
      fc.property(files, fc.nat(), path, (list, idx, newPath) => {
        const i = idx % list.length;
        fc.pre(!list.some((f) => f.path === newPath));
        const changed = list.map((f, k) => (k === i ? { ...f, path: newPath } : f));
        return computeBuildVersion(changed) !== computeBuildVersion(list);
      }),
      runs,
    );
  });

  it('changes when a file is added', () => {
    fc.assert(
      fc.property(files, path, content, (list, newPath, newContent) => {
        fc.pre(!list.some((f) => f.path === newPath));
        const added = [...list, { path: newPath, content: newContent }];
        return computeBuildVersion(added) !== computeBuildVersion(list);
      }),
      runs,
    );
  });

  it('changes when a file is removed', () => {
    fc.assert(
      fc.property(files, fc.nat(), (list, idx) => {
        const i = idx % list.length;
        const removed = list.filter((_, k) => k !== i);
        return computeBuildVersion(removed) !== computeBuildVersion(list);
      }),
      runs,
    );
  });
});
