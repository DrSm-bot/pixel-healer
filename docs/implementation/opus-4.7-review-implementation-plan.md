# Opus 4.7 Review — Implementation Plan

_Date: 2026-04-23_
_Source: focused Opus 4.7 code review (no code changes in review run)_

This document is the implementation playbook derived from the review output.
Use it top-down. Do not start lower-priority work before **P0** is done.

---

## 1) Execution Order (what to do first)

1. **PR-A (P0): I/O Safety Hardening**
2. **PR-B (P0): Re-analyze State Correctness**
3. **PR-C (P1): Processing UX/State robustness**
4. **PR-D (P1/P2): Detection hardening + defaults centralization**
5. **PR-E (P2): Maintainability cleanup**

Release gate recommendation from review: **PR-A + PR-B should be merged before public overwrite-heavy usage.**

---

## 2) P0 Findings (must fix now)

## P0-1 — Overwrite retry path is fragile in `saveImageToDirectorySafe`

- **Impact:** stale-handle recovery can duplicate/obscure failure flow; risk is in overwrite safety path.
- **Where:** `src/hooks/useFileSystem.ts` (`saveImageToDirectorySafe`, around existing retry loop).
- **Fix direction:**
  - Replace nested/looped retry logic with:
    1) one normal write attempt
    2) on `InvalidStateError`: reacquire handle once + one retry
    3) otherwise throw clear error
  - Avoid outer retry loop with stale references.

### Acceptance criteria
- On first `InvalidStateError`, second attempt with fresh handle succeeds.
- On repeated `InvalidStateError`, error message is explicit/actionable.
- No double-writes; `close()` is called once on success.

---

## P0-2 — `saveImageData` is misleading/dead in processing flow

- **Impact:** dead path increases confusion; dependency churn in `ProcessingView`.
- **Where:**
  - `src/hooks/useFileSystem.ts` (`saveImageData`)
  - `src/components/ProcessingView.tsx` (destructure/deps include `saveImageData`)
- **Fix direction:**
  - Remove usage/dependency from `ProcessingView`.
  - Either remove function entirely or simplify/document clearly as non-processing helper.

### Acceptance criteria
- `ProcessingView` no longer references `saveImageData`.
- Lint/tests pass with no functional regression.

---

## P0-3 — Re-analyze can show/use stale preview & hot-pixel state

- **Impact:** user may process with stale detection map if rerun fails/cancels.
- **Where:** `src/components/AnalysisView.tsx` (`handleAnalyze` start path).
- **Fix direction:**
  - At start of analyze:
    - revoke old `previewUrl` if present
    - `setPreviewUrl(null)`
    - `setHotPixelMap(null)`
    - `setSampleFrameData(null)`

### Acceptance criteria
- Re-analyze starts from clean state every time.
- Failed/aborted re-run does not surface old detection map/counts.

---

## 3) PR Breakdown (ready to delegate)

## PR-A — I/O Safety Hardening (P0)

### Scope
- `useFileSystem.ts` overwrite-safe write path cleanup.
- Remove dead/misleading processing references to `saveImageData`.

### Files (expected)
- `src/hooks/useFileSystem.ts`
- `src/components/ProcessingView.tsx`
- `src/hooks/useFileSystem.test.ts` (new)

### Tests to add
- recovery on first `InvalidStateError`
- failure after repeated `InvalidStateError`
- no retry on unrelated DOMException

---

## PR-B — Re-analyze State Correctness (P0)

### Scope
- Ensure fresh state on every analyze run.
- (Optional but recommended) split `ReviewView` from `AnalysisView` to reduce state coupling.

### Files (expected)
- `src/components/AnalysisView.tsx`
- `src/components/ReviewView.tsx` (optional new)
- `src/App.tsx` (if split applied)
- `src/components/AnalysisView.test.tsx` (new)

### Tests to add
- stale `previewUrl`/`hotPixelMap` cleared before run
- rerun failure keeps state clean

---

## PR-C — Processing UX/State Robustness (P1)

### Scope
- Stabilize `isOutputSameAsInput` sync effect dependencies.
- Optional in-flight verification state before "Fix All Images".
- Add cancellation/abort cleanup for processing loop (unmount-safe).

### Files (expected)
- `src/components/ProcessingView.tsx`
- `src/components/ProcessingView.test.tsx` (new)

---

## PR-D — Detection Hardening + Defaults Centralization (P1/P2)

### Scope
- Normalize adaptive threshold bounds (`adaptiveMin <= adaptiveMax`).
- Centralize default detection options.
- Clarify/align preset matching semantics.

### Files (expected)
- `src/core/detection.ts`
- `src/core/presets.ts`
- `src/store/app-store.ts`
- `src/core/detection.test.ts`
- `src/core/presets.test.ts` (new)

---

## PR-E — Maintainability Cleanup (P2)

### Scope
- Extract `AdvancedSettings` from `AnalysisView`.
- Remove dead state/plumbing and repetitive slider boilerplate.
- Keep behavior unchanged.

### Files (expected)
- `src/components/AnalysisView.tsx`
- `src/components/AnalysisView/AdvancedSettings.tsx` (new)
- helper field component(s), if needed

---

## 4) Tracking Checklist

## P0
- [ ] P0-1 overwrite retry flow fixed
- [ ] P0-2 dead/misleading save path cleaned up
- [ ] P0-3 re-analyze stale state cleared

## P1
- [ ] effect dependency cleanup in `ProcessingView`
- [ ] process-loop cancellation/unmount safety
- [ ] optional verify-output pending UX state
- [ ] threshold bound normalization

## P2
- [ ] preset matching semantics documented/expanded
- [ ] defaults centralized
- [ ] AnalysisView split/refactor

---

## 5) Quick Delegation Prompt Template

Use this when spawning Claude Code for each PR:

```text
Implement PR-[X] from docs/implementation/opus-4.7-review-implementation-plan.md.

Constraints:
- Keep scope strictly to PR-[X].
- New branch, focused commits, PR to main.
- Add tests listed for this PR.
- Run test + build and report results.

Return:
- root cause / fix summary
- changed files
- commit SHA(s)
- PR URL
- test/build output summary
```

---

## 6) Suggested Next Action

Start with **PR-A (I/O Safety Hardening)** immediately.
That is the highest-risk area and the best risk-reduction per hour.
