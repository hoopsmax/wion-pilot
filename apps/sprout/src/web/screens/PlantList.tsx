import type { Session } from '../api.ts';
import { everyDays, LIGHT_LABELS } from '../labels.ts';
import { Link } from '../Link.tsx';
import { useSproutData } from '../offline/SproutDataProvider.tsx';

interface PlantListProps {
  session: Session;
  onSignOut: () => void;
}

export function PlantList({ session, onSignOut }: PlantListProps) {
  const { ready, plants, waiting, conflicts } = useSproutData();
  // Signing out would leave unsent changes behind, so it waits until nothing is pending.
  const unsent = waiting + conflicts.length;

  return (
    <main className="page">
      <div className="topbar">
        <h1>Plants</h1>
        <button
          type="button"
          className="secondary"
          onClick={onSignOut}
          disabled={unsent > 0}
          aria-describedby={unsent > 0 ? 'sign-out-hint' : undefined}
        >
          Sign out
        </button>
      </div>
      {unsent > 0 && (
        <p id="sign-out-hint" className="muted">
          You can sign out once all your changes are synced.
        </p>
      )}
      <p className="muted">Signed in as {session.user.name}.</p>
      <p>
        <Link className="button" href="/plants/new">
          Add plant
        </Link>
      </p>
      {!ready && <p className="muted">Loading plants…</p>}
      {ready && plants.length === 0 && <p className="muted">No plants yet. Add your first one.</p>}
      {plants.length > 0 && (
        <ul className="plant-list" aria-label="Plants">
          {plants.map((plant) => (
            <li key={plant.id} className="card plant-row" data-testid="plant-row">
              <div>
                <h2 className="plant-name">{plant.name}</h2>
                <p className="plant-meta">
                  {LIGHT_LABELS[plant.light]} · {everyDays(plant.wateringIntervalDays)}
                </p>
                {!plant.synced && <p className="not-synced">Not synced yet</p>}
              </div>
              <Link
                className="button secondary"
                href={`/plants/${plant.id}/edit`}
                aria-label={`Edit ${plant.name}`}
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
