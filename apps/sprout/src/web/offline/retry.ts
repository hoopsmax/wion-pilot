/** The regular sync round: picks up other people's changes and retries waiting ones. */
export const RETRY_EVERY_MS = 10_000;

/**
 * How long to wait before trying again after `failedRounds` rounds in a row could not reach the
 * server while the browser said it was online: 1, 2, 4, 8 seconds, then the regular round.
 * Right after reconnecting the browser can say "online" a moment before requests get through;
 * waiting for the regular 10-second round would leave a person looking at "Offline" for no reason.
 */
export function retryDelay(failedRounds: number): number {
  return Math.min(1000 * 2 ** Math.max(0, failedRounds - 1), RETRY_EVERY_MS);
}
