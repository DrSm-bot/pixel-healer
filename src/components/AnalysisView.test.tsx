import { describe, expect, it, vi } from 'vitest';
import { resetAnalyzeState } from './analysis-state';

describe('resetAnalyzeState', () => {
  it('clears stale preview, hot pixel map, and sample frame data before analyze', () => {
    const revokePreviewUrl = vi.fn();
    const setPreviewUrl = vi.fn();
    const setHotPixelMap = vi.fn();
    const setSampleFrameData = vi.fn();

    resetAnalyzeState({
      previewUrl: 'blob:stale-preview',
      revokePreviewUrl,
      setPreviewUrl,
      setHotPixelMap,
      setSampleFrameData,
    });

    expect(revokePreviewUrl).toHaveBeenCalledWith('blob:stale-preview');
    expect(setPreviewUrl).toHaveBeenCalledWith(null);
    expect(setHotPixelMap).toHaveBeenCalledWith(null);
    expect(setSampleFrameData).toHaveBeenCalledWith(null);
  });

  it('keeps cleared state after a rerun failure', async () => {
    let previewUrl: string | null = 'blob:stale-preview';
    let hotPixelMap: unknown = new Map([['x,y', 1]]);
    let sampleFrameData: ImageData | null = new ImageData(1, 1);

    const runAnalyze = async () => {
      resetAnalyzeState({
        previewUrl,
        revokePreviewUrl: () => {},
        setPreviewUrl: (next) => {
          previewUrl = next;
        },
        setHotPixelMap: (next) => {
          hotPixelMap = next;
        },
        setSampleFrameData: (next) => {
          sampleFrameData = next;
        },
      });

      throw new Error('analysis failed');
    };

    await expect(runAnalyze()).rejects.toThrow('analysis failed');
    expect(previewUrl).toBeNull();
    expect(hotPixelMap).toBeNull();
    expect(sampleFrameData).toBeNull();
  });
});
