import { describe, expect, test } from 'vitest';
import { isAllowed, isDestructive, normalizeUrl, routePattern } from './urls.ts';

const start = 'http://localhost:4600/plants';

describe('normalizeUrl', () => {
  test('resolves relative links and drops the #fragment', () => {
    expect(normalizeUrl('/plants/new#top', start)).toBe('http://localhost:4600/plants/new');
  });

  test.each(['mailto:a@b.test', 'javascript:void(0)', 'tel:123', 'http://['])(
    'ignores %s',
    (href) => {
      expect(normalizeUrl(href, start)).toBeUndefined();
    },
  );
});

describe('isAllowed', () => {
  test('the start origin is always allowed', () => {
    expect(isAllowed('http://localhost:4600/sign-in', start)).toBe(true);
  });

  test('another origin only when allow-listed', () => {
    expect(isAllowed('https://example.test/help', start)).toBe(false);
    expect(isAllowed('https://example.test/help', start, ['example.test'])).toBe(true);
    expect(isAllowed('http://localhost:9999/', start)).toBe(false);
  });
});

describe('isDestructive', () => {
  test.each([
    ['Delete plant', '/plants/1'],
    ['Sign out', '/plants'],
    ['Log out', '/'],
    ['Continue', '/checkout'],
    ['Remove', '/x'],
    ['Pay now', '/x'],
    ['Go', '/account/sign-out'],
  ])('"%s" (%s) is destructive', (text, path) => {
    expect(isDestructive(text, `http://localhost:4600${path}`)).toBe(true);
  });

  test.each([
    ['Add plant', '/plants/new'],
    ['Edit Window fern', '/plants/1/edit'],
    ['Payroll FAQ', '/help'],
  ])('"%s" (%s) is safe to follow', (text, path) => {
    expect(isDestructive(text, `http://localhost:4600${path}`)).toBe(false);
  });
});

describe('routePattern', () => {
  test.each([
    ['/plants/5eed0000-0000-4000-8000-000000000002/edit', '/plants/:id/edit'],
    ['/orders/12345', '/orders/:id'],
    ['/plants/new', '/plants/new'],
    ['/plants/', '/plants'],
    ['/', '/'],
    ['/search?q=fern', '/search'],
  ])('%s → %s', (path, pattern) => {
    expect(routePattern(`http://localhost:4600${path}`)).toBe(pattern);
  });
});
