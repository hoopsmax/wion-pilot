import { useState } from 'react';
import type { PlantFields } from '../../shared/plant.ts';
import { FIELD_LABELS, shownValue } from '../labels.ts';
import { Link } from '../Link.tsx';
import { navigate } from '../navigation.ts';
import { fieldsAfterChoices, type Choice, type Conflict } from '../offline/conflicts.ts';
import type { FieldName } from '../offline/merge.ts';
import { useSproutData } from '../offline/SproutDataProvider.tsx';

const FIELDS: FieldName[] = ['name', 'light', 'wateringIntervalDays'];

/** True when fields other than the clashing ones were combined from both people's edits. */
function combinedOtherFields(conflict: Conflict): boolean {
  return FIELDS.some(
    (field) => !conflict.clashes.includes(field) && conflict.mine[field] !== conflict.latest[field],
  );
}

function allChoices(conflict: Conflict, choice: Choice): Partial<Record<FieldName, Choice>> {
  return Object.fromEntries(conflict.clashes.map((field) => [field, choice]));
}

function ChoiceGroup({
  conflict,
  field,
  choice,
  onChoose,
}: {
  conflict: Conflict;
  field: FieldName;
  choice: Choice | undefined;
  onChoose: (choice: Choice) => void;
}) {
  const options: [Choice, string, PlantFields[FieldName]][] = [
    ['mine', 'Yours', conflict.mine[field]],
    ['latest', `Latest (${conflict.latest.updatedByName})`, conflict.latest[field]],
  ];
  return (
    <fieldset className="card choice-group">
      <legend>{FIELD_LABELS[field]}</legend>
      <div className="choice-options">
        {options.map(([value, who, fieldValue]) => (
          <label key={value} className="choice-option">
            <input
              type="radio"
              name={field}
              value={value}
              checked={choice === value}
              onChange={() => {
                onChoose(value);
              }}
            />
            <span>
              {who}: <strong>{shownValue(field, fieldValue)}</strong>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ConflictScreen({ plantId }: { plantId: string }) {
  const { ready, conflicts, decide } = useSproutData();
  const [choices, setChoices] = useState<Partial<Record<FieldName, Choice>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const conflict = conflicts.find((open) => open.plantId === plantId);

  if (!ready) return <main className="page muted">Loading…</main>;
  if (!conflict) {
    return (
      <main className="page">
        <h1>No open conflict</h1>
        <p className="muted">This plant has no changes waiting for your decision.</p>
        <Link className="button secondary" href="/plants">
          Back to plants
        </Link>
      </main>
    );
  }

  const finish = async (chosen: Partial<Record<FieldName, Choice>>) => {
    setBusy(true);
    try {
      await decide(plantId, fieldsAfterChoices(conflict, chosen));
      navigate('/plants');
    } catch (problem) {
      console.error(problem);
      setError(problem instanceof Error ? problem.message : String(problem));
      setBusy(false);
    }
  };
  const everyFieldChosen = conflict.clashes.every((field) => choices[field] !== undefined);

  return (
    <main className="page">
      <h1>{conflict.latest.updatedByName} changed this plant while you were editing</h1>
      <p className="muted">
        You both changed {conflict.clashes.length === 1 ? 'this field' : 'these fields'} of “
        {conflict.latest.name}”. Choose which value to keep.
      </p>
      {error && (
        <p className="form-error" role="alert">
          Could not save your decision: {error}
        </p>
      )}
      {combinedOtherFields(conflict) && (
        <p className="muted">Other changes were combined automatically.</p>
      )}
      {conflict.clashes.map((field) => (
        <ChoiceGroup
          key={field}
          conflict={conflict}
          field={field}
          choice={choices[field]}
          onChoose={(choice) => {
            setChoices((current) => ({ ...current, [field]: choice }));
          }}
        />
      ))}
      <div className="actions">
        <button
          type="button"
          disabled={busy || !everyFieldChosen}
          onClick={() => void finish(choices)}
        >
          Save my choices
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void finish(allChoices(conflict, 'mine'))}
        >
          Keep all mine
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void finish(allChoices(conflict, 'latest'))}
        >
          Take all latest
        </button>
      </div>
    </main>
  );
}
