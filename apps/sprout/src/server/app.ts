import { join } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { bodyOf, sendError } from './http.ts';
import { verifyPassword } from './passwords.ts';
import { plantRoutes } from './plant-routes.ts';
import type { Sessions } from './sessions.ts';
import { readSproutData, type Store } from './store.ts';

export interface AppOptions {
  store: Store;
  sessions: Sessions;
  seedFile: string;
  /** Only test mode has the reset endpoint, so a normal run can never wipe its data by accident. */
  testMode: boolean;
  /** The built web app (dist/). Tests of the API alone leave it out. */
  webFolder?: string;
}

function tokenFrom(req: Request): string | undefined {
  const header = req.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
}

export function createApp({
  store,
  sessions,
  seedFile,
  testMode,
  webFolder,
}: AppOptions): express.Express {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  if (webFolder !== undefined) {
    app.use(express.static(webFolder));
    // Any other page is a screen of the app (like /plants/new), so a reload there still works.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(join(webFolder, 'index.html'));
    });
  }

  app.post('/api/session', async (req, res) => {
    const { email, password } = bodyOf(req.body);
    if (typeof email !== 'string' || typeof password !== 'string') {
      sendError(res, 400, 'Email and password are required.');
      return;
    }
    const user = await store.findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      sendError(res, 401, 'Email or password is wrong.');
      return;
    }
    res.json({
      token: sessions.start({ id: user.id, name: user.name }),
      user: { id: user.id, name: user.name, email: user.email },
    });
  });

  if (testMode) {
    app.post('/api/test/reset', async (_req, res) => {
      await store.replaceAll(await readSproutData(seedFile));
      sessions.endAll();
      res.status(204).end();
    });
  }

  app.use('/api', (req, res, next) => {
    const token = tokenFrom(req);
    const editor = token === undefined ? undefined : sessions.editorFor(token);
    if (editor === undefined) {
      sendError(res, 401, 'Please sign in.');
      return;
    }
    res.locals['editor'] = editor;
    next();
  });

  app.delete('/api/session', (req, res) => {
    const token = tokenFrom(req);
    if (token !== undefined) sessions.end(token);
    res.status(204).end();
  });

  app.use('/api/plants', plantRoutes(store));

  app.use('/api', (_req, res) => {
    sendError(res, 404, 'No such API endpoint.');
  });

  // Express calls a handler with four parameters only for errors.
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    // Once a reply has started, only Express itself can still close it cleanly.
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof SyntaxError) {
      sendError(res, 400, 'The request body is not valid JSON.');
      return;
    }
    console.error(error);
    sendError(res, 500, 'Something went wrong on the server. See the server log.');
  });

  return app;
}
