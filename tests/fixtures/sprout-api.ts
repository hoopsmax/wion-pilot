import { randomUUID } from 'node:crypto';
import type { APIRequestContext } from '@playwright/test';
import type { Plant, PlantFields } from '../../apps/sprout/src/shared/plant.ts';
import { CREDENTIALS, type PersonName } from './people.ts';

/** Every plant a test creates starts with this, so test data is easy to spot and clean up. */
export const TEST_PREFIX = 'wion-test-';

export function testPlantName(): string {
  return `${TEST_PREFIX}${randomUUID().slice(0, 8)}`;
}

async function body<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(
      `Sprout API ${response.url()} answered ${String(response.status())}: ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
}

/**
 * Talks to Sprout's API directly: for test data (set up and cleaned up without the UI) and for
 * checking what really reached the server.
 */
export class SproutApi {
  readonly #request: APIRequestContext;
  readonly #headers: Record<string, string>;

  private constructor(request: APIRequestContext, token: string) {
    this.#request = request;
    this.#headers = { authorization: `Bearer ${token}` };
  }

  static async signIn(request: APIRequestContext, person: PersonName): Promise<SproutApi> {
    const response = await request.post('/api/session', { data: CREDENTIALS[person] });
    const { token } = await body<{ token: string }>(response);
    return new SproutApi(request, token);
  }

  async plants(): Promise<Plant[]> {
    return body<Plant[]>(await this.#request.get('/api/plants', { headers: this.#headers }));
  }

  async plantNamed(name: string): Promise<Plant | undefined> {
    return (await this.plants()).find((plant) => plant.name === name);
  }

  async plant(id: string): Promise<Plant> {
    const found = (await this.plants()).find((plant) => plant.id === id);
    if (!found) throw new Error(`Plant ${id} is not on the server.`);
    return found;
  }

  async createPlant(fields: PlantFields): Promise<Plant> {
    const response = await this.#request.post('/api/plants', {
      headers: this.#headers,
      data: { id: randomUUID(), ...fields },
    });
    return body<Plant>(response);
  }

  async updatePlant(plant: Plant, fields: PlantFields): Promise<Plant> {
    const response = await this.#request.put(`/api/plants/${plant.id}`, {
      headers: this.#headers,
      data: { baseVersion: plant.version, ...fields },
    });
    return body<Plant>(response);
  }

  async deletePlant(id: string): Promise<void> {
    const response = await this.#request.delete(`/api/plants/${id}`, { headers: this.#headers });
    if (!response.ok()) {
      throw new Error(`Could not delete test plant ${id}: ${String(response.status())}`);
    }
  }
}
