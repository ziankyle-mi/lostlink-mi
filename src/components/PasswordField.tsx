import { Eye, EyeOff } from 'lucide-react';
import { Tooltip } from './InfoTip';
import { ValidationBubble } from './ValidationBubble';

interface PasswordFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
  minLength: number;
  visible: boolean;
  toggleLabel?: string;
  errorId: string;
  error?: string;
  className?: string;
  ariaProps: { 'aria-invalid': boolean; 'aria-describedby'?: string };
  onChange: (value: string) => void;
  onBlur: () => void;
  onToggleVisible: () => void;
}

export function PasswordField({
  id,
  name,
  label,
  value,
  placeholder,
  autoComplete,
  minLength,
  visible,
  toggleLabel = 'password',
  errorId,
  error,
  className = '',
  ariaProps,
  onChange,
  onBlur,
  onToggleVisible,
}: PasswordFieldProps) {
  return (
    <div className={`grid gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          {...ariaProps}
          placeholder={placeholder}
          className="h-[46px] w-full rounded-lg border border-[var(--color-line-strong)] bg-white pl-3 pr-12 text-base"
        />
        <Tooltip text={visible ? 'Hide password' : 'Show password'} className="absolute right-0.5">
          <button
            type="button"
            onClick={onToggleVisible}
            aria-label={visible ? `Hide ${toggleLabel}` : `Show ${toggleLabel}`}
            aria-pressed={visible}
            className="grid h-[44px] w-[44px] place-items-center rounded-lg text-[#454545] hover:text-[#0a0a0a] cursor-pointer"
          >
            {visible ? (
              <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
            ) : (
              <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
            )}
          </button>
        </Tooltip>
      </div>
      <ValidationBubble id={errorId} message={error} />
    </div>
  );
}
