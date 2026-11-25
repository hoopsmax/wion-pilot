import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createApp } from './app.ts';
import { createSessions } from './sessions.ts';
import { copySeed, createStore } from './store.ts';

const appFolder = resolve(import.meta.dirname, '../..');
const seedFile = join(appFolder, 'data/seed.json');
const webFolder = join(appFolder, 'dist');
const dataFile = resolve(process.env['SPROUT_DATA_FILE'] ?? join(appFolder, 'data/db.json'));
const port = Number(process.env['SPROUT_PORT'] ?? '4600');
const testMode = process.env['SPROUT_TEST_MODE'] === '1';

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`SPROUT_PORT must be a port number, got "${process.env['SPROUT_PORT'] ?? ''}".`);
}

if (!existsSync(join(webFolder, 'index.html'))) {
  throw new Error('The Sprout web app is not built yet. Run: npm run build -w @wion-pilot/sprout');
}

// The first run starts from the seed data; later runs keep what people changed.
if (!existsSync(dataFile)) {
  await copySeed(seedFile, dataFile);
}

const app = createApp({
  store: createStore(dataFile),
  sessions: createSessions(),
  seedFile,
  testMode,
  webFolder,
});
app.listen(port, (error) => {
  // Starting Sprout a second time is the usual cause; say so instead of a stack trace.
  if (error && 'code' in error && error.code === 'EADDRINUSE') {
    console.error(
      `Port ${String(port)} is busy. Is Sprout already running? ` +
        `Stop it, or start this one with SPROUT_PORT=${String(port + 1)}.`,
    );
    process.exit(1);
  }
  if (error) throw error;
  console.log(`Sprout runs at http://localhost:${String(port)}${testMode ? ' (test mode)' : ''}`);
});
