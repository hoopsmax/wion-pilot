import { describe, expect, test } from 'vitest';
import { sameScreen, screenshotPath, triageLinks } from './crawl-rules.ts';

const start = 'http://localhost:4600/';

describe('triageLinks', () => {
  test('follows the app’s own pages once, and says why the others are left alone', () => {
    const { follow, skipped } = triageLinks(
      [
        { text: 'Add plant', href: 'http://localhost:4600/plants/new' },
        { text: 'Add plant', href: 'http://localhost:4600/plants/new#top' },
        { text: 'Help', href: 'https://help.example.com/' },
        { text: 'Delete Fern', href: 'http://localhost:4600/plants/1/delete' },
        { text: 'Mail us', href: 'mailto:hello@example.com' },
      ],
      start,
    );
    expect(follow).toEqual(['http://localhost:4600/plants/new']);
    expect(skipped.map((link) => link.url)).toEqual([
      'https://help.example.com/',
      'http://localhost:4600/plants/1/delete',
    ]);
    expect(skipped[0]?.reason).toMatch(/allowed domains/);
    expect(skipped[1]?.reason).toMatch(/destructive/);
  });

  test('a listed domain is followed', () => {
    const links = [{ text: 'Docs', href: 'https://docs.example.com/start' }];
    expect(triageLinks(links, start, ['docs.example.com']).follow).toEqual([
      'https://docs.example.com/start',
    ]);
  });
});

describe('screenshotPath', () => {
  test.each([
    ['/plants/:id/edit', 'screens/plants-id-edit.png'],
    ['/sign-in', 'screens/sign-in.png'],
    ['/', 'screens/home.png'],
  ])('%s → %s', (pattern, path) => {
    expect(screenshotPath(pattern)).toBe(path);
  });

  test('never reuses a name that is taken', () => {
    expect(screenshotPath('/a/b', new Set(['screens/a-b.png']))).toBe('screens/a-b-2.png');
  });
});

describe('sameScreen', () => {
  const list = {
    title: 'Sprout',
    headings: ['Plants'],
    forms: [],
    elements: [],
    testIds: [{ testId: 'plant-row', count: 5, locator: "getByTestId('plant-row')" }],
  };

  test('equal content is the same screen, whatever the address', () => {
    expect(sameScreen(list, { ...list })).toBe(true);
  });

  test('any difference makes another screen', () => {
    expect(sameScreen(list, { ...list, headings: ['Add plant'] })).toBe(false);
  });
});
