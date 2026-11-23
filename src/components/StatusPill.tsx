const TONE_CLASS = {
  green: 'border-[#c2dec9] bg-[#e7f3ea] text-[#15522b]',
  amber: 'border-[#f4d68c] bg-[#fef3c7] text-[#7c3f05]',
  red: 'border-[#fecaca] bg-[#fee2e2] text-[#991b1b]',
} as const;

export type StatusTone = keyof typeof TONE_CLASS;

export function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${TONE_CLASS[tone]}`}>
      {label}
    </span>
  );
}
