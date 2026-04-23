import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { HotPixelMap } from '@/types';
import { imageDataToDataUrl, revokeDataUrl } from '@/core/image-utils';
import { cloneImageData } from '@/core/repair';
import {
  clamp,
  nextSliderPercent,
  pointerXToPercent,
} from './before-after-geometry';
import { buildAfterImage } from './before-after-image';

export { buildAfterImage };

export type ComparisonMode = 'slider' | 'toggle' | 'side-by-side';

interface BeforeAfterComparisonProps {
  sampleFrameData: ImageData | null;
  hotPixelMap: HotPixelMap | null;
  /** Optional: fallback "before" image URL (e.g. preview with hot pixel overlay). */
  fallbackBeforeUrl?: string | null;
  /** Injection point for tests: override blob url creation. */
  toUrl?: (data: ImageData) => Promise<string>;
  /** Injection point for tests: override blob url cleanup. */
  revoke?: (url: string) => void;
}

const DEFAULT_MODES: { id: ComparisonMode; label: string; hint: string }[] = [
  { id: 'slider', label: 'Slider', hint: 'Drag or use arrow keys' },
  { id: 'toggle', label: 'Toggle', hint: 'Click to flip Before/After' },
  { id: 'side-by-side', label: 'Side by side', hint: 'See both at once' },
];

export function BeforeAfterComparison({
  sampleFrameData,
  hotPixelMap,
  fallbackBeforeUrl,
  toUrl = imageDataToDataUrl,
  revoke = revokeDataUrl,
}: BeforeAfterComparisonProps) {
  const [mode, setMode] = useState<ComparisonMode>('slider');
  const [sliderPct, setSliderPct] = useState(50);
  const [showAfter, setShowAfter] = useState(true);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const hotPixelCount = hotPixelMap?.pixels.size ?? 0;

  // Generate before/after URLs from the sample frame data.
  useEffect(() => {
    let cancelled = false;
    let createdBefore: string | null = null;
    let createdAfter: string | null = null;

    setIsReady(false);
    setError(null);

    (async () => {
      try {
        if (!sampleFrameData || !hotPixelMap) {
          if (!cancelled) setIsReady(true);
          return;
        }

        const afterImage = buildAfterImage(sampleFrameData, hotPixelMap);
        if (!afterImage) {
          if (!cancelled) setIsReady(true);
          return;
        }

        const beforeClone = cloneImageData(sampleFrameData);
        const [bUrl, aUrl] = await Promise.all([
          toUrl(beforeClone),
          toUrl(afterImage),
        ]);

        if (cancelled) {
          revoke(bUrl);
          revoke(aUrl);
          return;
        }

        createdBefore = bUrl;
        createdAfter = aUrl;
        setBeforeUrl(bUrl);
        setAfterUrl(aUrl);
        setIsReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render comparison');
          setIsReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (createdBefore) revoke(createdBefore);
      if (createdAfter) revoke(createdAfter);
    };
  }, [sampleFrameData, hotPixelMap, toUrl, revoke]);

  // Pointer handlers for the slider mode.
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      draggingRef.current = true;
      containerRef.current.setPointerCapture?.(e.pointerId);
      const rect = containerRef.current.getBoundingClientRect();
      setSliderPct(pointerXToPercent(e.clientX, rect));
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setSliderPct(pointerXToPercent(e.clientX, rect));
    },
    []
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    containerRef.current?.releasePointerCapture?.(e.pointerId);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const next = nextSliderPercent(e.key, sliderPct, {
        shift: e.shiftKey,
        step: 1,
        bigStep: 10,
      });
      if (next !== null) {
        e.preventDefault();
        setSliderPct(next);
      }
    },
    [sliderPct]
  );

  const effectiveBefore = beforeUrl ?? fallbackBeforeUrl ?? null;
  const effectiveAfter = afterUrl;
  const canCompare = !!(effectiveBefore && effectiveAfter);
  const clampedSliderPct = clamp(sliderPct, 0, 100);
  const visibleAfterPct = Math.round(100 - clampedSliderPct);

  const modes = useMemo(() => DEFAULT_MODES, []);

  if (!sampleFrameData || !hotPixelMap) {
    return null;
  }

  return (
    <div
      className="bg-cosmos-900/50 rounded-lg p-6 mb-6"
      data-testid="before-after-comparison"
    >
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="font-semibold">Before / After Preview</h3>
          <p className="text-sm text-gray-400">
            {hotPixelCount === 0
              ? 'No hot pixels detected — "after" will look identical to "before".'
              : `Previewing repair of ${hotPixelCount} hot pixel${hotPixelCount === 1 ? '' : 's'} on the first sample frame.`}
          </p>
        </div>
        <div
          className="inline-flex rounded-lg border border-cosmos-700 overflow-hidden"
          role="tablist"
          aria-label="Comparison mode"
        >
          {modes.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={m.hint}
                onClick={() => setMode(m.id)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-cosmos-600 text-white'
                    : 'bg-transparent text-cosmos-300 hover:bg-cosmos-800'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 mb-2" role="alert">
          {error}
        </p>
      )}

      {!canCompare && !error && (
        <div
          className="h-64 rounded-lg border border-cosmos-700 flex items-center justify-center text-sm text-gray-400"
          data-testid="before-after-loading"
        >
          {isReady ? 'No preview available.' : 'Rendering preview…'}
        </div>
      )}

      {canCompare && mode === 'slider' && (
        <div
          ref={containerRef}
          className="relative select-none overflow-hidden rounded-lg border border-cosmos-700 bg-black touch-none"
          style={{ aspectRatio: `${sampleFrameData.width} / ${sampleFrameData.height}` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="slider"
          aria-label="Before/after comparison slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={visibleAfterPct}
          aria-valuetext={`${visibleAfterPct}% after`}
          data-testid="before-after-slider"
        >
          <img
            src={effectiveBefore}
            alt="Before repair"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ clipPath: `inset(0 0 0 ${clampedSliderPct}%)` }}
            data-testid="before-after-after-layer"
          >
            <img
              src={effectiveAfter}
              alt="After repair"
              className="absolute inset-0 w-full h-full object-contain"
              draggable={false}
            />
          </div>
          <div
            className="absolute top-0 bottom-0 w-px bg-white/80 pointer-events-none"
            style={{ left: `${clampedSliderPct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-cosmos-900 text-xs font-bold pointer-events-none"
            style={{ left: `${clampedSliderPct}%` }}
            aria-hidden="true"
          >
            ↔
          </div>
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-xs text-white pointer-events-none">
            Before
          </span>
          <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 text-xs text-white pointer-events-none">
            After
          </span>
        </div>
      )}

      {canCompare && mode === 'toggle' && (
        <div>
          <div
            className="relative overflow-hidden rounded-lg border border-cosmos-700 bg-black"
            style={{ aspectRatio: `${sampleFrameData.width} / ${sampleFrameData.height}` }}
            data-testid="before-after-toggle"
          >
            <img
              src={showAfter ? effectiveAfter : effectiveBefore}
              alt={showAfter ? 'After repair' : 'Before repair'}
              className="absolute inset-0 w-full h-full object-contain"
              draggable={false}
            />
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-xs text-white">
              {showAfter ? 'After' : 'Before'}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAfter((v) => !v)}
              className="px-4 py-2 bg-cosmos-700 hover:bg-cosmos-600 rounded-lg text-sm font-medium"
              aria-pressed={showAfter}
              data-testid="before-after-toggle-button"
            >
              Show {showAfter ? 'Before' : 'After'}
            </button>
            <span className="text-xs text-gray-400">
              Tip: quickly flip between states to spot changes.
            </span>
          </div>
        </div>
      )}

      {canCompare && mode === 'side-by-side' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="before-after-sbs">
          <figure className="m-0">
            <div
              className="relative overflow-hidden rounded-lg border border-cosmos-700 bg-black"
              style={{ aspectRatio: `${sampleFrameData.width} / ${sampleFrameData.height}` }}
            >
              <img
                src={effectiveBefore}
                alt="Before repair"
                className="absolute inset-0 w-full h-full object-contain"
                draggable={false}
              />
            </div>
            <figcaption className="text-xs text-gray-400 mt-1 text-center">Before</figcaption>
          </figure>
          <figure className="m-0">
            <div
              className="relative overflow-hidden rounded-lg border border-cosmos-700 bg-black"
              style={{ aspectRatio: `${sampleFrameData.width} / ${sampleFrameData.height}` }}
            >
              <img
                src={effectiveAfter}
                alt="After repair"
                className="absolute inset-0 w-full h-full object-contain"
                draggable={false}
              />
            </div>
            <figcaption className="text-xs text-gray-400 mt-1 text-center">After</figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
