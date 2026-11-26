import { useState } from 'react';
import { fieldsOf } from '../../shared/plant.ts';
import { dayOf, daysUntilWatering, reminderText } from '../../shared/watering.ts';
import type { Session } from '../api.ts';
import { everyDays, LIGHT_LABELS } from '../labels.ts';
import { Link } from '../Link.tsx';
import type { ShownPlant } from '../offline/outbox.ts';
import { useSproutData } from '../offline/SproutDataProvider.tsx';

/** "Water today", "Water in 3 days" or "2 days overdue"; overdue and due plants stand out. */
function Reminder({ plant, today }: { plant: ShownPlant; today: string }) {
  const daysLeft = daysUntilWatering(plant.lastWateredOn, plant.wateringIntervalDays, today);
  const urgency = daysLeft < 0 ? 'overdue' : daysLeft === 0 ? 'due' : 'later';
  return <p className={`reminder reminder-${urgency}`}>{reminderText(daysLeft)}</p>;
}

interface PlantListProps {
  session: Session;
  onSignOut: () => void;
}

export function PlantList({ session, onSignOut }: PlantListProps) {
  const { ready, plants, waiting, conflicts, save } = useSproutData();
  const [problem, setProblem] = useState<string>();
  const today = dayOf(new Date());
  // Signing out would leave unsent changes behind, so it waits until nothing is pending.
  const unsent = waiting + conflicts.length;

  // Watering is an edit like any other: saved on this device first, then synced.
  const markWatered = async (plant: ShownPlant) => {
    setProblem(undefined);
    try {
      await save(plant.id, { ...fieldsOf(plant), lastWateredOn: today }, plant.server);
    } catch (error) {
      setProblem(`Could not mark ${plant.name} watered: ${String(error)}`);
    }
  };

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
      {problem && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
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
                <Reminder plant={plant} today={today} />
                {!plant.synced && <p className="not-synced">Not synced yet</p>}
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="secondary"
                  aria-label={`Mark ${plant.name} watered`}
                  // Watering twice on one day changes nothing, so the button rests until tomorrow.
                  disabled={plant.lastWateredOn === today}
                  onClick={() => void markWatered(plant)}
                >
                  Watered
                </button>
                <Link
                  className="button secondary"
                  href={`/plants/${plant.id}/edit`}
                  aria-label={`Edit ${plant.name}`}
                >
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
