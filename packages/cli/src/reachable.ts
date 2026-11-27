/** Checks the app answers before a browser starts, so "it is not running" gets a plain message. */
export async function assertReachable(url: string): Promise<void> {
  try {
    await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    throw new Error(`Cannot reach ${url}. Is the app running? For Sprout: npm run demo`, {
      cause: error,
    });
  }
}
