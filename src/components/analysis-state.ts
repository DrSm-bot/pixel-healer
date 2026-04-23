export type AnalyzeStartReset = {
  previewUrl: string | null;
  revokePreviewUrl: (url: string) => void;
  setPreviewUrl: (url: string | null) => void;
  setHotPixelMap: (map: null) => void;
  setSampleFrameData: (data: ImageData | null) => void;
};

export function resetAnalyzeState({
  previewUrl,
  revokePreviewUrl,
  setPreviewUrl,
  setHotPixelMap,
  setSampleFrameData,
}: AnalyzeStartReset): void {
  if (previewUrl) {
    revokePreviewUrl(previewUrl);
  }

  setPreviewUrl(null);
  setHotPixelMap(null);
  setSampleFrameData(null);
}
