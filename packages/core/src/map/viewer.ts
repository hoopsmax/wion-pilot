import type { AppMap, MappedElement, MappedField, MappedForm, Screen } from './app-map.ts';

/** Everything that goes into the page is escaped: the map holds text taken from a website. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A field's rules in one line, for example "required · min 1 · max 60". */
export function fieldRules(field: MappedField): string {
  return [
    field.required ? 'required' : '',
    field.min === undefined ? '' : `min ${field.min}`,
    field.max === undefined ? '' : `max ${field.max}`,
    field.options ? `options: ${field.options.join(', ')}` : '',
  ]
    .filter((rule) => rule !== '')
    .join(' · ');
}

function formHtml(form: MappedForm, index: number): string {
  const rows = form.fields
    .map(
      (field) =>
        `<tr><td>${escapeHtml(field.label)}</td><td>${escapeHtml(field.type)}</td><td>${escapeHtml(fieldRules(field))}</td></tr>`,
    )
    .join('');
  return `<h4>Form ${String(index + 1)}</h4><table><tr><th>Field</th><th>Type</th><th>Rules</th></tr>${rows}</table>`;
}

function elementHtml(element: MappedElement): string {
  const locator = element.locator
    ? `<code>${escapeHtml(element.locator)}</code>`
    : `<span class="problem">${escapeHtml(element.problem ?? 'No locator')}</span>`;
  return `<li><span class="kind">${element.kind}</span> ${escapeHtml(element.name || '(no name)')}: ${locator}</li>`;
}

function screenHtml(screen: Screen): string {
  const title = screen.headings[0] ?? screen.title;
  const forms = screen.forms.map(formHtml).join('');
  const elements = screen.elements.map(elementHtml).join('');
  const testIds = screen.testIds
    .map((t) => `<li><code>${escapeHtml(t.locator)}</code> × ${String(t.count)}</li>`)
    .join('');
  return `<section class="screen">
<h2>${escapeHtml(title)} <small>${escapeHtml(screen.pattern)}</small></h2>
<img src="${escapeHtml(screen.screenshot)}" alt="Screenshot of ${escapeHtml(title)}" loading="lazy">
<p class="url">${escapeHtml(screen.url)}${screen.alsoAt ? ` · also at ${escapeHtml(screen.alsoAt.join(', '))}` : ''}</p>
${screen.headings.length > 1 ? `<p>Headings: ${escapeHtml(screen.headings.join(' · '))}</p>` : ''}
${forms}
<h4>Buttons, links and fields</h4><ul>${elements || '<li>None.</li>'}</ul>
${testIds ? `<h4>Test ids</h4><ul>${testIds}</ul>` : ''}
</section>`;
}

/** A self-contained page that shows the map: one card per screen. */
export function buildViewer(map: AppMap): string {
  const skipped = map.skipped
    .map((s) => `<li>${escapeHtml(s.url)}: ${escapeHtml(s.reason)}</li>`)
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wion-Pilot app map</title>
<style>
body { font-family: system-ui, sans-serif; margin: 0 auto; max-width: 70rem; padding: 1rem; color: #1f2a22; background: #f7faf7; }
.screen { background: #fff; border: 1px solid #cfd9d1; border-radius: .75rem; padding: 1rem; margin: 1rem 0; }
.screen img { max-width: 100%; border: 1px solid #cfd9d1; border-radius: .5rem; }
h2 small { color: #5b6b60; font-weight: 400; font-size: .9rem; }
.url { color: #5b6b60; font-size: .9rem; }
.kind { display: inline-block; min-width: 3.5rem; color: #2f6b3a; font-size: .8rem; text-transform: uppercase; }
.problem { color: #b3261e; }
table { border-collapse: collapse; } td, th { border: 1px solid #cfd9d1; padding: .3rem .6rem; text-align: left; }
code { background: #eef3ef; padding: .1rem .3rem; border-radius: .3rem; }
</style>
</head>
<body>
<h1>App map</h1>
<p>${String(map.screens.length)} screens from <code>${escapeHtml(map.startUrl)}</code>, mapped ${escapeHtml(map.createdAt)}.</p>
${map.screens.map(screenHtml).join('\n')}
${skipped ? `<h2>Links not followed</h2><ul>${skipped}</ul>` : ''}
</body>
</html>
`;
}
