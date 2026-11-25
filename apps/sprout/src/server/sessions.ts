import { randomUUID } from 'node:crypto';

export type Sessions = ReturnType<typeof createSessions>;

/** Sign-ins live in memory: restarting the server signs everyone out, which is fine for a demo. */
export function createSessions() {
  const userIdByToken = new Map<string, string>();
  return {
    start(userId: string): string {
      const token = randomUUID();
      userIdByToken.set(token, userId);
      return token;
    },
    userIdFor(token: string): string | undefined {
      return userIdByToken.get(token);
    },
    end(token: string): void {
      userIdByToken.delete(token);
    },
    endAll(): void {
      userIdByToken.clear();
    },
  };
}
