import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Plant } from '../shared/plant.ts';
import { createApp } from './app.ts';
import { hashPassword } from './passwords.ts';
import { createSessions } from './sessions.ts';
import { createStore, type SproutData } from './store.ts';

const plantId = '5eed0000-0000-4000-8000-000000000001';
const seed: SproutData = {
  users: [
    { id: 'ava', email: 'ava@sprout.test', name: 'Ava', passwordHash: hashPassword('pw-ava') },
    { id: 'ben', email: 'ben@sprout.test', name: 'Ben', passwordHash: hashPassword('pw-ben') },
  ],
  plants: [
    {
      id: plantId,
      name: 'Window fern',
      light: 'medium',
      wateringIntervalDays: 4,
      version: 1,
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'ava',
      updatedByName: 'Ava',
    },
  ],
};

let folder: string;
let server: Server;
let baseUrl: string;

async function startApp(testMode = false, withWebApp = false): Promise<void> {
  folder = await mkdtemp(join(tmpdir(), 'sprout-app-'));
  const seedFile = join(folder, 'seed.json');
  const dataFile = join(folder, 'db.json');
  await writeFile(seedFile, JSON.stringify(seed));
  await copyFile(seedFile, dataFile);
  const webFolder = join(folder, 'dist');
  await mkdir(webFolder);
  await writeFile(join(webFolder, 'index.html'), '<title>Sprout</title>');
  const app = createApp({
    store: createStore(dataFile),
    sessions: createSessions(),
    seedFile,
    testMode,
    ...(withWebApp ? { webFolder } : {}),
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${String((server.address() as AddressInfo).port)}`;
}

function call(method: string, path: string, body?: unknown, token?: string): Promise<Response> {
  return fetch(baseUrl + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function signIn(email: string, password: string): Promise<string> {
  const response = await call('POST', '/api/session', { email, password });
  expect(response.status).toBe(200);
  return ((await response.json()) as { token: string }).token;
}

const edit = (baseVersion: number, name: string) => ({
  baseVersion,
  name,
  light: 'medium',
  wateringIntervalDays: 4,
});

beforeEach(() => startApp());

afterEach(async () => {
  server.close();
  await rm(folder, { recursive: true, force: true });
});

describe('signing in', () => {
  test('a wrong password is refused', async () => {
    expect(
      (await call('POST', '/api/session', { email: 'ava@sprout.test', password: 'x' })).status,
    ).toBe(401);
  });

  test('the API needs a signed-in user', async () => {
    expect((await call('GET', '/api/plants')).status).toBe(401);
    expect((await call('GET', '/api/plants', undefined, 'made-up-token')).status).toBe(401);
  });

  test('a signed-in user sees the plants', async () => {
    const token = await signIn('ava@sprout.test', 'pw-ava');
    const plants = (await (await call('GET', '/api/plants', undefined, token)).json()) as Plant[];
    expect(plants.map((plant) => plant.name)).toEqual(['Window fern']);
  });
});

describe('plants', () => {
  test('invalid fields come back with a message per field', async () => {
    const token = await signIn('ava@sprout.test', 'pw-ava');
    const response = await call(
      'POST',
      '/api/plants',
      { id: crypto.randomUUID(), name: '', light: 'medium', wateringIntervalDays: 0 },
      token,
    );
    expect(response.status).toBe(400);
    const { error } = (await response.json()) as { error: { fields: Record<string, string> } };
    expect(Object.keys(error.fields).sort()).toEqual(['name', 'wateringIntervalDays']);
  });

  test('Ava and Ben edit the same plant: the second edit gets a conflict with the latest plant', async () => {
    const ava = await signIn('ava@sprout.test', 'pw-ava');
    const ben = await signIn('ben@sprout.test', 'pw-ben');

    const first = await call('PUT', `/api/plants/${plantId}`, edit(1, 'Fern (Ava)'), ava);
    expect(first.status).toBe(200);

    const second = await call('PUT', `/api/plants/${plantId}`, edit(1, 'Fern (Ben)'), ben);
    expect(second.status).toBe(409);
    const { latest } = (await second.json()) as { latest: Plant };
    expect(latest).toMatchObject({
      name: 'Fern (Ava)',
      version: 2,
      updatedBy: 'ava',
      updatedByName: 'Ava',
    });
  });

  test('a body that is not JSON is a clear 400', async () => {
    const token = await signIn('ava@sprout.test', 'pw-ava');
    const response = await fetch(`${baseUrl}/api/plants`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: '{ broken',
    });
    expect(response.status).toBe(400);
  });
});

describe('the reset endpoint', () => {
  test('does not exist in a normal run', async () => {
    expect((await call('POST', '/api/test/reset')).status).toBe(401);
  });

  test('in test mode, restores the seed data and signs everyone out', async () => {
    server.close();
    await startApp(true);
    const token = await signIn('ava@sprout.test', 'pw-ava');
    await call('DELETE', `/api/plants/${plantId}`, undefined, token);

    expect((await call('POST', '/api/test/reset')).status).toBe(204);
    expect((await call('GET', '/api/plants', undefined, token)).status).toBe(401);
    const fresh = await signIn('ava@sprout.test', 'pw-ava');
    const plants = (await (await call('GET', '/api/plants', undefined, fresh)).json()) as Plant[];
    expect(plants).toHaveLength(1);
  });
});

describe('the web app', () => {
  beforeEach(async () => {
    server.close();
    await rm(folder, { recursive: true, force: true });
    await startApp(false, true);
  });

  test.each(['/', '/plants', '/plants/new', '/plants/some-id/edit'])(
    '%s gets the app page, so a reload works on every screen',
    async (path) => {
      const response = await call('GET', path);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('<title>Sprout</title>');
    },
  );

  test('API paths are still the API', async () => {
    expect((await call('GET', '/api/plants')).status).toBe(401);
  });
});
