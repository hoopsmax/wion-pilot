import type { Session } from '../api.ts';
import { everyDays, LIGHT_LABELS } from '../labels.ts';
import { Link } from '../Link.tsx';
import { useSproutData } from '../offline/SproutDataProvider.tsx';

interface PlantListProps {
  session: Session;
  onSignOut: () => void;
}

export function PlantList({ session, onSignOut }: PlantListProps) {
  const { ready, plants } = useSproutData();

  return (
    <main className="page">
      <div className="topbar">
        <h1>Plants</h1>
        <button type="button" className="secondary" onClick={onSignOut}>
          Sign out
        </button>
      </div>
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
