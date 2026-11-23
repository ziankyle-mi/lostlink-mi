import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { HelpCircle } from 'lucide-react';

let hintSupportCached: boolean | null = null;
function supportsPopoverHint(): boolean {
  if (hintSupportCached !== null) return hintSupportCached;
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('div') as HTMLDivElement & { popover?: string };
    probe.popover = 'hint';
    hintSupportCached = probe.popover === 'hint';
  } catch {
    hintSupportCached = false;
  }
  return hintSupportCached;
}

function supportsNativeAnchor(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('position-area: block-start');
}

function positionPopoverFixed(
  trigger: HTMLElement,
  pop: HTMLElement,
  preferred: 'top' | 'bottom'
) {
  const rect = trigger.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let side: 'top' | 'bottom' = preferred;
  if (preferred === 'top' && rect.top - popRect.height - margin < 8) {
    side = 'bottom';
  } else if (preferred === 'bottom' && rect.bottom + popRect.height + margin > vh - 8) {
    side = 'top';
  }

  const rawLeft = rect.left + rect.width / 2 - popRect.width / 2;
  const left = Math.max(12, Math.min(vw - popRect.width - 12, rawLeft));
  const top =
    side === 'top'
      ? Math.max(8, rect.top - popRect.height - margin)
      : Math.min(vh - popRect.height - 8, rect.bottom + margin);

  pop.dataset.actualSide = side;
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
  pop.style.right = 'auto';
  pop.style.bottom = 'auto';
}

function openPopover(pop: HTMLElement, trigger: HTMLElement, preferred: 'top' | 'bottom') {
  const el = pop as HTMLElement & {
    showPopover?: (opts?: { source?: HTMLElement }) => void;
    matches: (s: string) => boolean;
  };
  if (typeof el.showPopover !== 'function') return;
  try {
    if (!el.matches(':popover-open')) {
      el.showPopover({ source: trigger });
    }
  } catch {
    try {
      el.showPopover();
    } catch {
      return;
    }
  }
  if (supportsNativeAnchor()) {
    const tr = trigger.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    pop.dataset.actualSide = pr.top + pr.height / 2 < tr.top + tr.height / 2 ? 'top' : 'bottom';
  } else {
    positionPopoverFixed(trigger, pop, preferred);
  }
}

function closePopover(pop: HTMLElement | null) {
  if (!pop) return;
  const el = pop as HTMLElement & {
    hidePopover?: () => void;
    matches: (s: string) => boolean;
  };
  if (typeof el.hidePopover !== 'function') return;
  try {
    if (el.matches(':popover-open')) el.hidePopover();
  } catch {
    // Already closed
  }
}

interface TooltipProps {
  text: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * Hover/focus clarification tooltip rendered in the native Top Layer (`popover="hint"`).
 * Satisfies WCAG 1.4.13 (hoverable, Escape-dismissible, persistent, never steals focus).
 */
export function Tooltip({ text, children, side = 'top', className = '' }: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const nativeAnchor = supportsNativeAnchor();
  const popoverType = supportsPopoverHint() ? 'hint' : 'manual';
  const anchorName = `--tip-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const clearTimers = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleOpen = useCallback(
    (delay: number) => {
      clearTimers();
      openTimerRef.current = window.setTimeout(() => {
        if (triggerRef.current && popRef.current) {
          openPopover(popRef.current, triggerRef.current, side);
        }
      }, delay);
    },
    [clearTimers, side]
  );

  const scheduleClose = useCallback(
    (delay = 110) => {
      clearTimers();
      closeTimerRef.current = window.setTimeout(() => {
        closePopover(popRef.current);
      }, delay);
    },
    [clearTimers]
  );

  const closeNow = useCallback(() => {
    clearTimers();
    closePopover(popRef.current);
  }, [clearTimers]);

  // Only bind Escape listener when popover="manual" is actually open (popover="hint" handles Escape natively).
  useEffect(() => {
    const pop = popRef.current;
    if (!pop || popoverType !== 'manual') return () => clearTimers();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNow();
    };
    const onToggle = (e: Event) => {
      const te = e as Event & { newState?: string };
      if (te.newState === 'open') document.addEventListener('keydown', onKeyDown);
      else document.removeEventListener('keydown', onKeyDown);
    };
    pop.addEventListener('toggle', onToggle);
    return () => {
      clearTimers();
      pop.removeEventListener('toggle', onToggle);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [clearTimers, closeNow, popoverType]);

  return (
    <span
      ref={triggerRef}
      style={nativeAnchor ? ({ anchorName } as CSSProperties) : undefined}
      className={`inline-flex ${className}`}
      onMouseEnter={() => scheduleOpen(180)}
      onMouseLeave={() => scheduleClose(110)}
      onFocus={() => scheduleOpen(80)}
      onBlur={() => scheduleClose(60)}
      onPointerDown={closeNow}
    >
      {children}
      <div
        ref={popRef}
        id={id}
        role="tooltip"
        data-infotip=""
        data-side={side}
        data-anchored={nativeAnchor ? 'native' : 'js'}
        style={nativeAnchor ? ({ positionAnchor: anchorName } as CSSProperties) : undefined}
        {...({ popover: popoverType } as Record<string, string>)}
        onMouseEnter={clearTimers}
        onMouseLeave={() => scheduleClose(100)}
      >
        <div className="infotip-body" data-side={side}>
          {text}
        </div>
      </div>
    </span>
  );
}

interface ToggletipProps {
  label: string;
  text: string;
  side?: 'top' | 'bottom';
}

/**
 * Explicit `?` info button for policy/format guidance on desktop and touch devices.
 * Opens on hover, focus, or tap (`popovertargetaction="show"`), closes on Escape or outside tap.
 */
export function Toggletip({ label, text, side = 'top' }: ToggletipProps) {
  const id = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const nativeAnchor = supportsNativeAnchor();
  // Where popover="hint" is unsupported (e.g. Safari), use popover="auto" so tap light-dismisses.
  const popoverType = supportsPopoverHint() ? 'hint' : 'auto';
  const anchorName = `--tip-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const clearClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const pop = popRef.current;
    if (!pop) return;
    const onToggle = (e: Event) => {
      const te = e as Event & { newState?: string };
      const isNowOpen = te.newState === 'open';
      setOpen(isNowOpen);
      if (isNowOpen && btnRef.current) {
        if (nativeAnchor) {
          const tr = btnRef.current.getBoundingClientRect();
          const pr = pop.getBoundingClientRect();
          pop.dataset.actualSide = pr.top + pr.height / 2 < tr.top + tr.height / 2 ? 'top' : 'bottom';
        } else {
          positionPopoverFixed(btnRef.current, pop, side);
        }
      }
    };
    pop.addEventListener('toggle', onToggle);
    return () => {
      clearClose();
      pop.removeEventListener('toggle', onToggle);
    };
  }, [clearClose, nativeAnchor, side]);

  const show = () => {
    clearClose();
    if (btnRef.current && popRef.current) {
      openPopover(popRef.current, btnRef.current, side);
    }
  };

  const scheduleHide = () => {
    clearClose();
    closeTimerRef.current = window.setTimeout(() => {
      closePopover(popRef.current);
    }, 120);
  };

  return (
    <span className="inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        style={nativeAnchor ? ({ anchorName } as CSSProperties) : undefined}
        {...({
          interestfor: id,
          popovertarget: id,
          popovertargetaction: 'show',
        } as Record<string, string>)}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) closePopover(popRef.current);
          else show();
        }}
        className="-m-2.5 inline-grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#454545] transition-colors hover:text-[#1f6b3a] cursor-pointer"
      >
        <HelpCircle className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
      </button>
      <div
        ref={popRef}
        id={id}
        role="tooltip"
        data-infotip=""
        data-side={side}
        data-anchored={nativeAnchor ? 'native' : 'js'}
        style={nativeAnchor ? ({ positionAnchor: anchorName } as CSSProperties) : undefined}
        {...({ popover: popoverType } as Record<string, string>)}
        onMouseEnter={clearClose}
        onMouseLeave={scheduleHide}
      >
        <div className="infotip-body" data-side={side}>
          {text}
        </div>
      </div>
    </span>
  );
}
