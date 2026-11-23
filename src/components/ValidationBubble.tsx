import { useCallback, useState } from 'react';
import { AlertCircle } from 'lucide-react';

let liveRegion: HTMLDivElement | null = null;
let liveTimer: number | null = null;

/** Single polite live region for blur-time field validation announcements. */
function announceError(message: string) {
  if (typeof document === 'undefined') return;
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.className = 'visually-hidden';
    document.body.appendChild(liveRegion);
  }
  if (liveTimer !== null) window.clearTimeout(liveTimer);
  liveRegion.textContent = '';
  // Wait briefly so screen readers finish announcing the newly focused control first.
  liveTimer = window.setTimeout(() => {
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
  const [dirty, setDirty] = useState<Partial<Record<K, boolean>>>({});

  const handleChange = useCallback(
    (field: K, value: string) => {
      setDirty((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const nextErr = validators[field](value);
        if (nextErr === prev[field]) return prev;
        if (!nextErr) clearAnnouncedError();
        return { ...prev, [field]: nextErr ?? undefined };
      });
    },
    [validators]
  );

  const handleBlur = useCallback(
    (field: K, value: string) => {
      if (!dirty[field] && !errors[field] && value.trim().length === 0) return;
      const msg = validators[field](value);
      setErrors((prev) => ({ ...prev, [field]: msg ?? undefined }));
      if (msg) announceError(msg);
      else clearAnnouncedError();
    },
    [dirty, errors, validators]
  );

  const validateAll = useCallback(
    (values: Record<K, string>, elementIds: Partial<Record<K, string>>) => {
      const nextErrors: Partial<Record<K, string>> = {};
      let firstBad: K | null = null;
      (Object.keys(validators) as K[]).forEach((key) => {
        const msg = validators[key](values[key] ?? '');
        if (msg) {
          nextErrors[key] = msg;
          if (!firstBad) firstBad = key;
        }
      });
      setErrors(nextErrors);
      if (firstBad) {
        const elId = elementIds[firstBad];
        if (elId) document.getElementById(elId)?.focus();
        return false;
      }
      clearAnnouncedError();
      return true;
    },
    [validators]
  );

  const setFieldError = useCallback((field: K, message: string | null) => {
    setErrors((prev) => ({ ...prev, [field]: message ?? undefined }));
  }, []);

  const reset = useCallback(() => {
    setErrors({});
    setDirty({});
    clearAnnouncedError();
  }, []);

  const ariaFor = (field: K, errorId: string) => ({
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? errorId : undefined,
  });

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
