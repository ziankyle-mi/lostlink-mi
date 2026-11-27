import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, Copy, X } from 'lucide-react';
import { useLostLink } from '../lib/store';
import type { Item } from '../types';
import { Toggletip, Tooltip } from './InfoTip';
import { PhotoSlider } from './PhotoSlider';
import { useFieldValidation, ValidationBubble } from './ValidationBubble';

const DIALOG_SHELL =
  'm-auto w-[min(100%-24px,580px)] max-h-[min(92svh,780px)] flex-col overflow-hidden rounded-2xl border-0 bg-white p-0 text-[#0a0a0a] shadow-[0_24px_48px_-12px_rgba(10,10,10,0.28)] open:flex backdrop:bg-[#0a0a0a]/50 backdrop:backdrop-blur-[2px]';

const FIELD_BASE =
  'w-full rounded-lg border border-[var(--color-line-strong)] bg-white text-[15px] text-[#0a0a0a] transition-colors hover:border-black/35 focus:border-[#1f6b3a] focus:outline-none focus:ring-2 focus:ring-[#1f6b3a]/20';

const CLOSE_BTN =
  'grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[#454545] transition-colors hover:bg-black/[0.06] hover:text-[#0a0a0a] cursor-pointer';

function closeOnBackdrop(e: MouseEvent<HTMLDialogElement>, onClose: () => void) {
  if (e.target === e.currentTarget) onClose();
}

interface InspectDialogProps {
  item: Item | null;
  onClose: () => void;
}

export function InspectDialog({ item, onClose }: InspectDialogProps) {
  const { currentUser, submitClaim, submitSighting } = useLostLink();
  const isAdmin = currentUser?.role === 'admin';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copyTimerRef = useRef<number | null>(null);
  const [proof, setProof] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const proofValidators = useMemo(
    () => ({
      proof: (v: string) => {
        const len = v.trim().length;
        if (len === 0) {
          return item?.type === 'found'
            ? 'Describe unique marks, contents, or serial details so LSB Room 102 can verify ownership.'
            : 'Share where and when you saw this item or where you turned it in.';
        }
        if (len < 20) {
          return `Add at least ${20 - len} more character${20 - len === 1 ? '' : 's'} (minimum 20).`;
        }
        return null;
      },
    }),
    [item?.type]
  );
  const validation = useFieldValidation(proofValidators);

  const itemId = item?.id ?? null;

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    if (itemId) {
      setProof('');
      setStatus(null);
      setCopied(false);
      validation.reset();
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [itemId, validation.reset]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.referenceCode);
      setCopied(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!item || submitting) return;
    if (!validation.validateAll({ proof }, { proof: 'claim-proof-input' })) return;
    const isFoundItem = item.type === 'found';
    setSubmitting(true);
    try {
      const res = isFoundItem
        ? await submitClaim(item.id, proof)
        : await submitSighting(item.id, proof);
      if (!res.ok) {
        setStatus({
          ok: false,
          msg: res.error ?? (isFoundItem ? 'Could not submit claim.' : 'Could not send sighting.'),
        });
        return;
      }
      setStatus({
        ok: true,
        msg: isFoundItem
          ? `Claim logged for ${item.referenceCode}. Bring your DLSAU ID to LSB Room 102 for verification.`
          : `Sighting sent to the owner of ${item.referenceCode}. Thank you for helping out.`,
      });
      setProof('');
      validation.reset();
    } catch {
      setStatus({
        ok: false,
        msg: isFoundItem ? 'Could not submit claim.' : 'Could not send sighting.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const proofLen = proof.trim().length;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => closeOnBackdrop(e, onClose)}
      aria-labelledby="inspect-dlg-title"
      className={DIALOG_SHELL}
    >
      {item && (
        <>
          <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] bg-[#f6f7f2] px-6 py-4">
            <div className="min-w-0">
              <h2
                id="inspect-dlg-title"
                className="truncate text-[19px] font-semibold leading-snug tracking-[-0.02em]"
              >
                {item.name}
              </h2>
              <p className="mt-0.5 text-[13px] text-[#454545]">{item.custodyNote}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close modal" className={CLOSE_BTN}>
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>

          <div className="grid gap-5 overflow-y-auto px-6 py-5 [scrollbar-color:rgba(10,10,10,0.22)_transparent] [scrollbar-width:thin]">
            <div className="aspect-video overflow-hidden rounded-xl border border-[var(--color-line)] bg-[#ecefe7]">
              <PhotoSlider
                images={item.images}
                alt={item.name}
                shielded={item.hidePhoto}
                adminUnlocked={isAdmin}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="min-w-0 flex-1 text-[15px] leading-relaxed text-[#454545]">
                {item.description}
              </p>
              <Tooltip text="Copy reference tag for LSB Room 102 custody desk">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-line-strong)] bg-[#f6f7f2] px-3 font-mono text-xs text-[#0a0a0a] transition-colors hover:bg-[#ecefe7] cursor-pointer"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-[#1f6b3a]" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-[#454545]" aria-hidden="true" />
                  )}
                  <span>{copied ? `Copied ${item.referenceCode}` : item.referenceCode}</span>
                </button>
              </Tooltip>
            </div>

            <dl className="grid grid-cols-1 gap-3 rounded-xl bg-[#f6f7f2] px-4 py-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-[#454545]">Building</dt>
                <dd className="mt-0.5 font-medium text-[#0a0a0a]">{item.location}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#454545]">Category</dt>
                <dd className="mt-0.5 font-medium text-[#0a0a0a]">{item.category}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#454545]">Date logged</dt>
                <dd className="mt-0.5 font-mono text-[13px] font-medium text-[#0a0a0a]">
                  {item.eventDate}
                </dd>
              </div>
            </dl>

            {currentUser ? (
              <form onSubmit={handleSubmit} noValidate className="grid gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <label htmlFor="claim-proof-input" className="text-[13px] font-medium text-[#0a0a0a]">
                      {item.type === 'found'
                        ? 'Ownership proof'
                        : 'Sighting or turn-in note'}
                    </label>
                    <Toggletip
                      label={
                        item.type === 'found'
                          ? 'About private ownership proof'
                          : 'About sighting notifications'
                      }
                      text={
                        item.type === 'found'
                          ? 'Kept private: only you and LSB Room 102 DO Admins can read your ownership proof.'
                          : 'Sent directly as an in-app notification to the owner without creating a custody claim.'
                      }
                    />
                  </div>
                  <span
                    className={`font-mono text-xs ${proofLen >= 20 ? 'text-[#1f6b3a]' : 'text-[#454545]'
                      }`}
                  >
                    {proofLen} / 20 min
                  </span>
                </div>
                <div>
                  <textarea
                    id="claim-proof-input"
                    name="proof"
                    value={proof}
                    onChange={(e) => {
                      setProof(e.target.value);
                      validation.handleChange('proof', e.target.value);
                    }}
                    onBlur={() => validation.handleBlur('proof', proof)}
                    {...validation.ariaFor('proof', 'claim-proof-err')}
                    minLength={20}
                    required
                    placeholder={
                      item.type === 'found'
                        ? 'Describe unique scratches, inside cards, stickers, or contents…'
                        : 'Share where and when you saw it, or if you turned it in at LSB Room 102…'
                    }
                    className={`${FIELD_BASE} min-h-[96px] resize-y px-3.5 py-2.5 leading-relaxed`}
                  />
                  <ValidationBubble id="claim-proof-err" message={validation.errors.proof} />
                </div>
                {status && (
                  <p
                    role="status"
                    className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-[13px] font-medium ${status.ok
                        ? 'border-[#c2dec9] bg-[#e7f3ea] text-[#15522b]'
                        : 'border-[#f5b5b5] bg-[#fef2f2] text-[#991b1b]'
                      }`}
                  >
                    {status.ok ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>{status.msg}</span>
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-[46px] w-full items-center justify-center rounded-lg bg-[#1f6b3a] text-[15px] font-medium text-white transition-all hover:bg-[#19562e] active:translate-y-px disabled:opacity-60 cursor-pointer"
                >
                  {submitting
                    ? 'Sending…'
                    : item.type === 'found'
                      ? 'Submit claim for LSB pickup'
                      : 'Send sighting to owner'}
                </button>
              </form>
            ) : (
              <div className="grid gap-3 rounded-xl border border-[#c2dec9] bg-[#f6f7f2] p-4">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#0a0a0a]">
                    Verify with your DLSAU account
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#454545]">
                    {item.type === 'found'
                      ? `Sign in with @dlsau.edu.ph to submit private ownership proof for ${item.referenceCode} at LSB Room 102.`
                      : `Sign in with @dlsau.edu.ph to send a sighting or turn-in note to the owner of ${item.referenceCode}.`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <Link
                    to={`/login?next=${encodeURIComponent(`/feed?inspect=${item.id}`)}`}
                    onClick={onClose}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[#1f6b3a] px-4 text-sm font-medium text-white transition-colors hover:bg-[#19562e]"
                  >
                    {item.type === 'found' ? 'Sign in to claim' : 'Sign in to send sighting'}
                  </Link>
                  <Link
                    to={`/register?next=${encodeURIComponent(`/feed?inspect=${item.id}`)}`}
                    onClick={onClose}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--color-line-strong)] bg-white px-4 text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-[#ecefe7]"
                  >
                    Create account
                  </Link>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
