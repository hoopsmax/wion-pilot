import { describe, expect, test } from 'vitest';
import { parseRoute, pathFor, type Route } from './router.ts';

describe('parseRoute', () => {
  test.each<[string, Route]>([
    ['/', { name: 'plants' }],
    ['/plants', { name: 'plants' }],
    ['/plants/', { name: 'plants' }],
    ['/sign-in', { name: 'sign-in' }],
    ['/plants/new', { name: 'new-plant' }],
    ['/plants/abc-123/edit', { name: 'edit-plant', id: 'abc-123' }],
    ['/plants/abc-123', { name: 'not-found' }],
    ['/plants/abc/edit/more', { name: 'not-found' }],
    ['/settings', { name: 'not-found' }],
  ])('%s', (path, route) => {
    expect(parseRoute(path)).toEqual(route);
  });
});

describe('pathFor', () => {
  test.each<Route>([
    { name: 'sign-in' },
    { name: 'plants' },
    { name: 'new-plant' },
    { name: 'edit-plant', id: 'a b/c' },
  ])('round-trips %o', (route) => {
    expect(parseRoute(pathFor(route))).toEqual(route);
  });
});
