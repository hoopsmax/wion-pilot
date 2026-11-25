import { randomUUID } from 'node:crypto';
import type { Editor } from '../shared/plant.ts';

export type Sessions = ReturnType<typeof createSessions>;

/** Sign-ins live in memory: restarting the server signs everyone out, which is fine for a demo. */
export function createSessions() {
  const editorByToken = new Map<string, Editor>();
  return {
    start(editor: Editor): string {
      const token = randomUUID();
      editorByToken.set(token, editor);
      return token;
    },
    editorFor(token: string): Editor | undefined {
      return editorByToken.get(token);
    },
    end(token: string): void {
      editorByToken.delete(token);
    },
    endAll(): void {
      editorByToken.clear();
    },
  };
}
