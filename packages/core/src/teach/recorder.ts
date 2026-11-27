import type { Page } from '@playwright/test';
import { isRecordedAction, type RecordedAction } from './steps.ts';

/** The page reports each action by calling this function, which Playwright exposes to it. */
const BINDING = '__wionRecord';

/*
 * The few parts of the DOM the in-page recorder touches. Wion-Pilot is Node code without DOM
 * types (see map/in-page.ts). The recorder is sent to the browser as source text, so it cannot use
 * anything else in this module, and repeats the small label lookup that map/forms.ts also has.
 */
interface RecordedElement {
  tagName: string;
  type?: string;
  value?: string;
  textContent: string | null;
  labels?: ArrayLike<{ textContent: string | null }> | null;
  selectedOptions?: ArrayLike<{ textContent: string | null }>;
  style: { outline: string };
  getAttribute(name: string): string | null;
  closest(selector: string): RecordedElement | null;
}

interface RecordedEvent {
  target: RecordedElement | null;
  altKey?: boolean;
  preventDefault(): void;
  stopImmediatePropagation(): void;
}

interface RecorderWindow {
  document: {
    addEventListener(
      type: string,
      listener: (event: RecordedEvent) => void,
      capture: boolean,
    ): void;
    getElementById(id: string): { textContent: string | null } | null;
  };
  setTimeout(callback: () => void, ms: number): unknown;
  wionRecorderInstalled?: boolean;
  /** Reports the page has sent and Node has not confirmed yet. */
  wionPendingReports?: Set<Promise<unknown>>;
}

/** Runs in the browser: reports clicks, typing, choices and Option/Alt+clicks, once per page. */
function recorderInPage(binding: string): void {
  const page = globalThis as unknown as RecorderWindow & Record<string, unknown>;
  if (page.wionRecorderInstalled === true) return;
  page.wionRecorderInstalled = true;
  const pending = new Set<Promise<unknown>>();
  page.wionPendingReports = pending;
  // Each report is a promise that settles once Node has received it; stop() waits for all.
  const send = (action: Record<string, string>) => {
    const record = page[binding];
    if (typeof record !== 'function') return;
    const delivered = (record as (action: Record<string, string>) => Promise<unknown>)(action);
    pending.add(delivered);
    void delivered.finally(() => pending.delete(delivered));
  };
  const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();
  const nameOf = (element: RecordedElement) =>
    clean(
      element.getAttribute('aria-label') ??
        (element.tagName === 'INPUT' ? element.value : element.textContent),
    );
  const labelOf = (field: RecordedElement) => {
    const byLabel = field.labels?.[0]?.textContent;
    if (byLabel) return clean(byLabel);
    const ariaLabel = field.getAttribute('aria-label');
    if (ariaLabel) return clean(ariaLabel);
    const ids = (field.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
    return clean(ids.map((id) => page.document.getElementById(id)?.textContent ?? '').join(' '));
  };
  const flash = (element: RecordedElement) => {
    const before = element.style.outline;
    element.style.outline = '3px solid #2f6b3a';
    page.setTimeout(() => {
      element.style.outline = before;
    }, 700);
  };
  const controls =
    'a[href], button, [role="button"], [role="link"], input[type="submit"], input[type="button"]';

  page.document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!target) return;
      // Option/Alt+click marks a text to check: it must not also act as a click.
      if (event.altKey === true) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const text = clean(target.textContent);
        if (text) {
          send({ kind: 'see', text });
          flash(target);
        }
        return;
      }
      const control = target.closest(controls);
      if (!control) return;
      const name = nameOf(control);
      send(
        name ? { kind: 'click', name } : { kind: 'unnamed', what: control.tagName.toLowerCase() },
      );
    },
    true,
  );

  page.document.addEventListener(
    'input',
    (event) => {
      const field = event.target;
      if (!field || (field.tagName !== 'INPUT' && field.tagName !== 'TEXTAREA')) return;
      if (field.type === 'checkbox' || field.type === 'radio') return;
      const label = labelOf(field);
      if (field.type === 'password') send({ kind: 'secret', label: label || 'a password field' });
      else if (!label) send({ kind: 'unnamed', what: 'field' });
      else send({ kind: 'fill', label, value: field.value ?? '' });
    },
    true,
  );

  page.document.addEventListener(
    'change',
    (event) => {
      const field = event.target;
      if (!field) return;
      const label = labelOf(field);
      if (field.tagName === 'SELECT') {
        const option = clean(field.selectedOptions?.[0]?.textContent);
        send(label ? { kind: 'choose', label, option } : { kind: 'unnamed', what: 'list' });
      } else if (field.type === 'checkbox' || field.type === 'radio') {
        send({ kind: 'unsupported', what: `${field.type} "${label}"` });
      }
    },
    true,
  );
}

export interface Recording {
  /** Everything recorded so far, after the page has delivered its last report. */
  stop(): Promise<RecordedAction[]>;
}

/**
 * Starts recording what a person does in this page, and in every page it loads later. Nothing
 * done before this call is recorded, such as signing in.
 */
export async function startRecording(page: Page): Promise<Recording> {
  const actions: RecordedAction[] = [];
  await page.exposeFunction(BINDING, (action: unknown) => {
    // A report that is not an action (the app itself used the name, say) becomes a note.
    actions.push(
      isRecordedAction(action)
        ? action
        : {
            kind: 'unsupported',
            what: `an unknown report from the page: ${JSON.stringify(action)}`,
          },
    );
  });
  await page.addInitScript(recorderInPage, BINDING);
  await page.evaluate(recorderInPage, BINDING);
  return {
    async stop() {
      // Playwright does not promise that a page's reports arrive before the answer to a later
      // request, so the page itself is asked to wait until every report it sent was received.
      if (!page.isClosed()) {
        await page.evaluate(async () => {
          const reports = (globalThis as { wionPendingReports?: Set<Promise<unknown>> })
            .wionPendingReports;
          await Promise.allSettled([...(reports ?? [])]);
        });
      }
      return [...actions];
    },
  };
}
