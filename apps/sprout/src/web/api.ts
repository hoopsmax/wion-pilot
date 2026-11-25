import type { FieldErrors, Plant, PlantFields } from '../shared/plant.ts';

export interface SignedInUser {
  id: string;
  name: string;
  email: string;
}

export interface Session {
  token: string;
  user: SignedInUser;
}

/** An answer from the API that is not a success, with everything the screens need to explain it. */
export class ApiError extends Error {
  readonly status: number;
  readonly fields: FieldErrors;
  readonly latest: Plant | undefined;

  constructor(message: string, status: number, fields: FieldErrors = {}, latest?: Plant) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
    this.latest = latest;
  }
}

interface ErrorBody {
  error?: { message?: string; fields?: FieldErrors };
  latest?: Plant;
}

async function request<T>(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.status === 204) return undefined as T;
  const data = (await response.json()) as unknown;
  if (!response.ok) {
    const { error, latest } = data as ErrorBody;
    throw new ApiError(
      error?.message ?? `The server answered ${String(response.status)}.`,
      response.status,
      error?.fields,
      latest,
    );
  }
  return data as T;
}

export const api = {
  signIn: (email: string, password: string) =>
    request<Session>('POST', '/session', undefined, { email, password }),
  signOut: (token: string) => request<undefined>('DELETE', '/session', token),
  listPlants: (token: string) => request<Plant[]>('GET', '/plants', token),
  createPlant: (token: string, id: string, fields: PlantFields) =>
    request<Plant>('POST', '/plants', token, { id, ...fields }),
  updatePlant: (token: string, id: string, baseVersion: number, fields: PlantFields) =>
    request<Plant>('PUT', `/plants/${encodeURIComponent(id)}`, token, { baseVersion, ...fields }),
};
