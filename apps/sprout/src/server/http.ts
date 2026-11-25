import type { Response } from 'express';
import type { Editor, FieldErrors } from '../shared/plant.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

/** Request bodies are untrusted: anything that is not a plain object becomes an empty one. */
export function bodyOf(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  fields?: FieldErrors,
): void {
  res.status(status).json({ error: { message, ...(fields ? { fields } : {}) } });
}

/** The signed-in user, set by the sign-in check in app.ts. */
export function currentEditor(res: Response): Editor {
  const editor: unknown = res.locals['editor'];
  if (typeof editor !== 'object' || editor === null) {
    throw new Error('currentEditor was called on a route without the sign-in check.');
  }
  return editor as Editor;
}
