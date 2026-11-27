import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

let liveRegion: HTMLDivElement | null = null;
let liveTimer: number | null = null;

/** Single polite live region for blur-time field validation announcements. */
function announceError(message: string) {
  if (typeof document === 'undefined') return;
  if (!liveRegion || !liveRegion.isConnected) {
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.className = 'visually-hidden';
    document.body.appendChild(liveRegion);
  }
  if (liveTimer !== null) window.clearTimeout(liveTimer);
  liveRegion.textContent = '';
  // Wait briefly so screen readers finish announcing the newly focused control first.
  liveTimer = window.setTimeout(() => {
    liveTimer = null;
    if (liveRegion) liveRegion.textContent = message;
  }, 450);
}

export function clearAnnouncedError() {
  if (liveTimer !== null) {
    window.clearTimeout(liveTimer);
    liveTimer = null;
  }
  if (liveRegion) liveRegion.textContent = '';
}

interface ValidationBubbleProps {
  id: string;
  message?: string | null;
  className?: string;
}

/**
 * Anchored institutional error bubble displayed beneath invalid controls.
 * Shown only after field blur (if edited) or form submission; clears on input as soon as fixed.
 */
export function ValidationBubble({ id, message, className = '' }: ValidationBubbleProps) {
  if (!message) return null;
  return (
    <div
      id={id}
      data-validation-bubble=""
      className={`mt-1.5 flex items-start gap-2 rounded-lg border border-[#f5b5b5] bg-[#fef2f2] px-3 py-2 text-[13px] font-medium leading-snug text-[#991b1b] ${className}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#b91c1c]" aria-hidden="true" />
      <span>
        <span className="sr-only">Error: </span>
        {message}
      </span>
    </div>
  );
}

type ValidatorMap<K extends string> = Record<K, (value: string) => string | null>;

/**
 * Coordinates blur/input/submit validation timing without premature keystroke errors:
 * - blur: validates once the field has been edited (or previously flagged)
 * - input: clears or updates an existing error immediately without nagging untouched fields
 * - submit: validates every field and routes focus to the first invalid control
 */
export function useFieldValidation<K extends string>(validators: ValidatorMap<K>) {
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({});
  const errorsRef = useRef<Partial<Record<K, string>>>({});
  const dirtyRef = useRef<Partial<Record<K, boolean>>>({});
  const validatorsRef = useRef(validators);
  validatorsRef.current = validators;

  useEffect(() => clearAnnouncedError, []);

  const handleChange = useCallback((field: K, value: string) => {
    dirtyRef.current[field] = true;
    const prevErr = errorsRef.current[field];
    if (!prevErr) return;
    const nextErr = validatorsRef.current[field](value);
    if (nextErr === prevErr) return;
    if (!nextErr) clearAnnouncedError();
    const updated = { ...errorsRef.current, [field]: nextErr ?? undefined };
    errorsRef.current = updated;
    setErrors(updated);
  }, []);

  const handleBlur = useCallback((field: K, value: string) => {
    if (!dirtyRef.current[field] && !errorsRef.current[field] && value.trim().length === 0) return;
    const msg = validatorsRef.current[field](value);
    const updated = { ...errorsRef.current, [field]: msg ?? undefined };
    errorsRef.current = updated;
    setErrors(updated);
    if (msg) announceError(msg);
    else clearAnnouncedError();
  }, []);

  const validateAll = useCallback(
    (values: Record<K, string>, elementIds: Partial<Record<K, string>>) => {
      const nextErrors: Partial<Record<K, string>> = {};
      let firstBad: K | null = null;
      (Object.keys(validatorsRef.current) as K[]).forEach((key) => {
        const msg = validatorsRef.current[key](values[key] ?? '');
        if (msg) {
          nextErrors[key] = msg;
          if (!firstBad) firstBad = key;
        }
      });
      errorsRef.current = nextErrors;
      setErrors(nextErrors);
      if (firstBad) {
        const elId = elementIds[firstBad];
        if (elId) document.getElementById(elId)?.focus();
        return false;
      }
      clearAnnouncedError();
      return true;
    },
    []
  );

  const setFieldError = useCallback((field: K, message: string | null) => {
    const updated = { ...errorsRef.current, [field]: message ?? undefined };
    errorsRef.current = updated;
    setErrors(updated);
  }, []);

  const reset = useCallback(() => {
    errorsRef.current = {};
    dirtyRef.current = {};
    setErrors({});
    clearAnnouncedError();
  }, []);

  const ariaFor = useCallback(
    (field: K, errorId: string) => ({
      'aria-invalid': Boolean(errors[field]),
      'aria-describedby': errors[field] ? errorId : undefined,
    }),
    [errors]
  );

  return {
    errors,
    handleChange,
    handleBlur,
    validateAll,
    setFieldError,
    reset,
    ariaFor,
  };
}
