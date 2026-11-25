import type { ReactNode } from 'react';

/** The attributes that link an input to its error message, for screen readers and for tests. */
export function errorAttributes(id: string, error: string | undefined) {
  return error
    ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` }
    : { 'aria-invalid': false as const };
}

interface FieldProps {
  id: string;
  label: string;
  error: string | undefined;
  children: ReactNode;
}

export function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}
