import { useEffect, useState, type SubmitEvent } from 'react';
import {
  INTERVAL_MAX_DAYS,
  INTERVAL_MIN_DAYS,
  LIGHT_LEVELS,
  validatePlantFields,
  type FieldErrors,
  type Plant,
  type PlantFields,
} from '../../shared/plant.ts';
import { api, ApiError, type Session } from '../api.ts';
import { errorAttributes, Field } from '../Field.tsx';
import { LIGHT_LABELS } from '../labels.ts';
import { Link } from '../Link.tsx';
import { navigate } from '../navigation.ts';

interface PlantFormProps {
  session: Session;
  /** Missing for a new plant. */
  plantId?: string;
  onUnauthorized: () => void;
}

function save(session: Session, plant: Plant | undefined, fields: PlantFields): Promise<Plant> {
  return plant
    ? api.updatePlant(session.token, plant.id, plant.version, fields)
    : api.createPlant(session.token, crypto.randomUUID(), fields);
}

export function PlantForm({ session, plantId, onUnauthorized }: PlantFormProps) {
  const [plant, setPlant] = useState<Plant>();
  const [name, setName] = useState('');
  const [light, setLight] = useState('');
  const [interval, setInterval] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (plantId === undefined) return;
    api.listPlants(session.token).then(
      (plants) => {
        const found = plants.find((candidate) => candidate.id === plantId);
        if (!found) {
          setFormError('This plant does not exist (any more).');
          return;
        }
        setPlant(found);
        setName(found.name);
        setLight(found.light);
        setInterval(String(found.wateringIntervalDays));
      },
      (problem: unknown) => {
        if (problem instanceof ApiError && problem.status === 401) onUnauthorized();
        else setFormError(`Could not load the plant: ${String(problem)}`);
      },
    );
  }, [plantId, session.token, onUnauthorized]);

  const explain = (problem: unknown) => {
    if (problem instanceof ApiError && problem.status === 401) onUnauthorized();
    else if (problem instanceof ApiError && problem.status === 400) setErrors(problem.fields);
    else if (problem instanceof ApiError && problem.status === 409) {
      setFormError('Someone else changed this plant. Reload to see the latest.');
    } else if (problem instanceof ApiError) setFormError(problem.message);
    else setFormError('Could not reach Sprout. Check your connection and try again.');
  };

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setFormError(undefined);
    const validation = validatePlantFields({
      name,
      light,
      wateringIntervalDays: interval.trim() === '' ? undefined : Number(interval),
    });
    setErrors(validation.ok ? {} : validation.errors);
    if (!validation.ok) return;
    setBusy(true);
    try {
      await save(session, plant, validation.fields);
      navigate('/plants');
    } catch (problem) {
      explain(problem);
      setBusy(false);
    }
  };

  const hasErrors = Object.keys(errors).length > 0;
  const title = plantId === undefined ? 'Add plant' : 'Edit plant';

  return (
    <main className="page">
      <h1>{title}</h1>
      <form className="card" onSubmit={(event) => void submit(event)} noValidate>
        {(hasErrors || formError) && (
          <p className="form-error" role="alert" data-testid="form-errors">
            {formError ?? 'Please fix the marked fields.'}
          </p>
        )}
        <Field id="name" label="Name" error={errors.name}>
          <input
            id="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            {...errorAttributes('name', errors.name)}
          />
        </Field>
        <Field id="light" label="Light" error={errors.light}>
          <select
            id="light"
            value={light}
            onChange={(event) => {
              setLight(event.target.value);
            }}
            {...errorAttributes('light', errors.light)}
          >
            <option value="">Choose…</option>
            {LIGHT_LEVELS.map((level) => (
              <option key={level} value={level}>
                {LIGHT_LABELS[level]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="interval" label="Watering interval (days)" error={errors.wateringIntervalDays}>
          <input
            id="interval"
            type="number"
            inputMode="numeric"
            min={INTERVAL_MIN_DAYS}
            max={INTERVAL_MAX_DAYS}
            value={interval}
            onChange={(event) => {
              setInterval(event.target.value);
            }}
            {...errorAttributes('interval', errors.wateringIntervalDays)}
          />
        </Field>
        <div className="actions">
          <button type="submit" disabled={busy || (plantId !== undefined && plant === undefined)}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <Link className="button secondary" href="/plants">
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
