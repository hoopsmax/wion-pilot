import { useEffect, useState, type SubmitEvent } from 'react';
import {
  INTERVAL_MAX_DAYS,
  INTERVAL_MIN_DAYS,
  LIGHT_LEVELS,
  validatePlantFields,
  type FieldErrors,
} from '../../shared/plant.ts';
import { errorAttributes, Field } from '../Field.tsx';
import { LIGHT_LABELS } from '../labels.ts';
import { Link } from '../Link.tsx';
import { navigate } from '../navigation.ts';
import type { StartedFrom } from '../offline/outbox.ts';
import { useSproutData } from '../offline/SproutDataProvider.tsx';

interface PlantFormProps {
  /** Missing for a new plant. */
  plantId?: string;
}

export function PlantForm({ plantId }: PlantFormProps) {
  const data = useSproutData();
  const plant = data.plants.find((candidate) => candidate.id === plantId);
  const [name, setName] = useState('');
  const [light, setLight] = useState('');
  const [interval, setInterval] = useState('');
  const [filledIn, setFilledIn] = useState(false);
  const [startedFrom, setStartedFrom] = useState<StartedFrom>();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Fill the form once when the plant to edit is known; later syncs must not undo typing.
  useEffect(() => {
    if (!plant || filledIn) return;
    setName(plant.name);
    setLight(plant.light);
    setInterval(String(plant.wateringIntervalDays));
    setStartedFrom(plant.server);
    setFilledIn(true);
  }, [plant, filledIn]);

  const missing = plantId !== undefined && data.ready && !plant;

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
      // Saving only writes to this device; sending to the server happens in the background.
      await data.save(plantId, validation.fields, startedFrom);
      navigate('/plants');
    } catch (problem) {
      console.error(problem);
      setFormError(
        `Could not save: ${problem instanceof Error ? problem.message : String(problem)}`,
      );
      setBusy(false);
    }
  };

  const hasErrors = Object.keys(errors).length > 0;
  const title = plantId === undefined ? 'Add plant' : 'Edit plant';

  return (
    <main className="page">
      <h1>{title}</h1>
      <form className="card" onSubmit={(event) => void submit(event)} noValidate>
        {(hasErrors || formError || missing) && (
          <p className="form-error" role="alert" data-testid="form-errors">
            {missing
              ? 'This plant does not exist (any more).'
              : (formError ?? 'Please fix the marked fields.')}
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
          <button type="submit" disabled={busy || (plantId !== undefined && !filledIn)}>
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
