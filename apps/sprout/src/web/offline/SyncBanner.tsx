import { useSproutData } from './SproutDataProvider.tsx';

function changes(count: number): string {
  return count === 1 ? '1 change' : `${String(count)} changes`;
}

/** Always tells the user where their changes are: on this device, on their way, or saved. */
export function SyncBanner() {
  const { status, waiting, conflicts, problem } = useSproutData();

  const detail = {
    offline:
      waiting > 0 ? `${changes(waiting)} saved on this device` : 'Changes are saved on this device',
    syncing: waiting > 0 ? `Sending ${changes(waiting)}…` : 'Checking for updates…',
    synced: 'All changes are saved',
  }[status];
  const label = { offline: 'Offline', syncing: 'Syncing', synced: 'Synced' }[status];

  return (
    <div className={`sync-banner sync-${status}`} role="status" data-testid="sync-banner">
      <strong>{label}</strong> <span>{detail}</span>
      {conflicts.length > 0 && (
        <p className="sync-attention">
          {conflicts.length === 1
            ? '1 change needs your decision'
            : `${String(conflicts.length)} changes need your decision`}
        </p>
      )}
      {problem && <p className="sync-attention">Sync stopped: {problem}</p>}
    </div>
  );
}
