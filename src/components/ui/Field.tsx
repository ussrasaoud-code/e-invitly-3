"use client";

import { createContext, useContext, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

type Common = { label: string; error?: string; hint?: string; optional?: boolean; className?: string };

/** Mention « (facultatif) » dans la langue de la page */
export const OptionalLabelContext = createContext("facultatif");

function Wrapper({ id, label, error, hint, optional, className, children }: Common & { id: string; children: ReactNode }) {
  const optionalLabel = useContext(OptionalLabelContext);
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {optional ? <span className="ms-1 text-stone">({optionalLabel})</span> : null}
      </label>
      {children}
      {hint && !error ? <p id={`${id}-hint`} className="field-hint">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export function TextField({ label, error, hint, optional, className, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} optional={optional} className={className}>
      <input id={id} className="field" aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} {...props} />
    </Wrapper>
  );
}

export function TextArea({ label, error, hint, optional, className, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} optional={optional} className={className}>
      <textarea id={id} className="field" aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} {...props} />
    </Wrapper>
  );
}

export function SelectField({
  label,
  error,
  hint,
  optional,
  className,
  options,
  ...props
}: Common & SelectHTMLAttributes<HTMLSelectElement> & { options: ReadonlyArray<{ value: string; label: string }> }) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} optional={optional} className={className}>
      <select id={id} className="field" aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, error, hint)} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}
