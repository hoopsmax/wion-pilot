import { useEffect, useState } from 'react';
import type { Plant } from '../../shared/plant.ts';
import { api, ApiError, type Session } from '../api.ts';
import { everyDays, LIGHT_LABELS } from '../labels.ts';
import { Link } from '../Link.tsx';

interface PlantListProps {
  session: Session;
  onSignOut: () => void;
  onUnauthorized: () => void;
}

export function PlantList({ session, onSignOut, onUnauthorized }: PlantListProps) {
  const [plants, setPlants] = useState<Plant[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    // An answer that arrives after the user left this screen must not update it.
    let stillShown = true;
    api.listPlants(session.token).then(
      (list) => {
        if (stillShown) setPlants(list);
      },
      (problem: unknown) => {
        if (problem instanceof ApiError && problem.status === 401) {
          onUnauthorized();
        } else if (stillShown) {
          setError(problem instanceof Error ? problem.message : String(problem));
        }
      },
    );
    return () => {
      stillShown = false;
    };
  }, [session.token, onUnauthorized]);

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
      {error && (
        <p className="form-error" role="alert">
          Could not load the plants: {error}
        </p>
      )}
      {plants === undefined && !error && <p className="muted">Loading plants…</p>}
      {plants?.length === 0 && <p className="muted">No plants yet. Add your first one.</p>}
      {plants && plants.length > 0 && (
        <ul className="plant-list" aria-label="Plants">
          {plants.map((plant) => (
            <li key={plant.id} className="card plant-row" data-testid="plant-row">
              <div>
                <h2 className="plant-name">{plant.name}</h2>
                <p className="plant-meta">
                  {LIGHT_LABELS[plant.light]} · {everyDays(plant.wateringIntervalDays)}
                </p>
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
