import { describe, expect, test } from 'vitest';
import type { AppMap } from './app-map.ts';
import { buildViewer } from './viewer.ts';

const map: AppMap = {
  startUrl: 'http://localhost:4600/',
  createdAt: '2026-11-26T10:00:00.000Z',
  screens: [
    {
      pattern: '/plants/new',
      url: 'http://localhost:4600/plants/new',
      title: 'Sprout',
      headings: ['Add plant'],
      forms: [
        {
          fields: [
            { label: 'Name', type: 'text', required: false },
            {
              label: 'Watering interval (days)',
              type: 'number',
              required: false,
              min: '1',
              max: '60',
            },
          ],
        },
      ],
      elements: [
        {
          kind: 'button',
          role: 'button',
          name: 'Save',
          locator: "getByRole('button', { name: 'Save', exact: true })",
        },
        {
          kind: 'button',
          role: 'button',
          name: '',
          locator: undefined,
          problem: 'No accessible name',
        },
      ],
      testIds: [{ testId: 'sync-banner', count: 1, locator: "getByTestId('sync-banner')" }],
      screenshot: 'screens/plants-new.png',
    },
  ],
  skipped: [{ url: 'http://localhost:4600/sign-out', reason: 'destructive link' }],
};

describe('buildViewer', () => {
  const html = buildViewer(map);

  test('shows each screen with its route, screenshot, fields and locators', () => {
    expect(html).toContain('<h2>Add plant <small>/plants/new</small></h2>');
    expect(html).toContain('<img src="screens/plants-new.png" alt="Screenshot of Add plant"');
    expect(html).toContain(
      '<td>Watering interval (days)</td><td>number</td><td>min 1 · max 60</td>',
    );
    expect(html).toContain(
      '<code>getByRole(&#39;button&#39;, { name: &#39;Save&#39;, exact: true })</code>',
    );
  });

  test('shows problems and links that were not followed', () => {
    expect(html).toContain('<span class="problem">No accessible name</span>');
    expect(html).toContain('<li>http://localhost:4600/sign-out: destructive link</li>');
  });

  test('escapes text from the website, so a page cannot inject markup into the viewer', () => {
    const [screen] = map.screens;
    if (!screen) throw new Error('The test map has no screen.');
    const evil = buildViewer({
      ...map,
      screens: [{ ...screen, headings: ['<script>alert(1)</script>'] }],
    });
    expect(evil).not.toContain('<script>alert(1)</script>');
    expect(evil).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
