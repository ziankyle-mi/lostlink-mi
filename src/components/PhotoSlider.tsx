import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';

interface PhotoSliderProps {
  images: string[];
  alt: string;
  shielded?: boolean;
  adminUnlocked?: boolean;
  compact?: boolean;
}

export function PhotoSlider({
  images,
  alt,
  shielded = false,
  adminUnlocked = false,
  compact = false,
}: PhotoSliderProps) {
  const [index, setIndex] = useState(0);
  const firstImage = images[0];

  useEffect(() => {
    setIndex(0);
  }, [firstImage, images.length]);

  if ((shielded && !adminUnlocked) || images.length === 0) {
    return (
      <div className="grid h-full w-full place-items-center bg-[#ecefe7] p-4 text-center text-sm text-[#1f6b3a]">
        <div className="grid justify-items-center gap-1.5">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          <strong className="font-semibold text-[#0a0a0a]">
            {shielded ? 'Photo Shield Active' : 'No Photo Attached'}
          </strong>
          <span className="text-xs text-[#454545]">
            {shielded
              ? compact
                ? 'Visible to DO Admin only'
                : 'Protected photo · Visible to DO Admin at LSB Room 102'
              : 'Submitted without image'}
          </span>
        </div>
      </div>
    );
  }

  const safeIndex = index % images.length;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#ecefe7]">
      <div
        className="flex h-full w-full transition-transform duration-200 ease-out"
        style={{ transform: `translateX(-${safeIndex * 100}%)` }}
      >
        {images.map((src, i) => (
          <img
            key={`${i}-${src.length}`}
            src={src}
            alt={images.length > 1 ? `${alt} (photo ${i + 1} of ${images.length})` : alt}
            loading="lazy"
            className="h-full w-full shrink-0 object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ))}
      </div>

      {shielded && adminUnlocked && (
        <span
          className={`pointer-events-none absolute left-2.5 inline-flex items-center gap-1 rounded-md bg-[#134e3a]/92 px-2 py-1 font-mono text-[11px] font-medium text-[#daef8a] ${
            images.length > 1 ? 'bottom-14' : 'bottom-2.5'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Shielded · DO Admin only
        </span>
      )}

      {images.length > 1 && (
        <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((safeIndex - 1 + images.length) % images.length);
            }}
            aria-label="Previous photo"
            className="pointer-events-auto grid min-h-[44px] min-w-[44px] place-items-center rounded-full border border-[var(--color-line-strong)] bg-white/95 text-[#0a0a0a] hover:bg-white cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="pointer-events-auto rounded-full border border-[var(--color-line)] bg-white/95 px-2.5 py-1 font-mono text-xs text-[#0a0a0a]">
            {safeIndex + 1} / {images.length}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((safeIndex + 1) % images.length);
            }}
            aria-label="Next photo"
            className="pointer-events-auto grid min-h-[44px] min-w-[44px] place-items-center rounded-full border border-[var(--color-line-strong)] bg-white/95 text-[#0a0a0a] hover:bg-white cursor-pointer"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
