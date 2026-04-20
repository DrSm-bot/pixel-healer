/**
 * Deterministic regression gate for the synthetic evaluation baseline.
 *
 * The floor is intentionally below the current typical-profile baseline so small
 * runtime variance does not matter, but high enough to catch clear detection regressions.
 */

import { describe, expect, it } from 'vitest';
import { runBaselineEvaluation } from '../baseline';

const TYPICAL_BASELINE_SEED = 1337;
const MIN_BASELINE_F1 = 0.45;

describe('synthetic baseline regression gate', () => {
  it('keeps typical-profile F1 above the documented floor', async () => {
    const report = await runBaselineEvaluation({ seed: TYPICAL_BASELINE_SEED });

    expect(report.f1).toBeGreaterThanOrEqual(MIN_BASELINE_F1);
  });
});
