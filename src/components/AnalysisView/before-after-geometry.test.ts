import { describe, expect, it } from 'vitest';
import {
  clamp,
  pointerXToPercent,
  nextSliderPercent,
} from './before-after-geometry';

describe('clamp', () => {
  it('returns the value when inside the range', () => {
    expect(clamp(50, 0, 100)).toBe(50);
  });

  it('clamps values below min', () => {
    expect(clamp(-10, 0, 100)).toBe(0);
  });

  it('clamps values above max', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('returns min when value is NaN', () => {
    expect(clamp(Number.NaN, 0, 100)).toBe(0);
  });
});

describe('pointerXToPercent', () => {
  it('returns 0 at the left edge', () => {
    expect(pointerXToPercent(0, { left: 0, width: 200 })).toBe(0);
  });

  it('returns 100 at the right edge', () => {
    expect(pointerXToPercent(200, { left: 0, width: 200 })).toBe(100);
  });

  it('returns 50 at the midpoint', () => {
    expect(pointerXToPercent(100, { left: 0, width: 200 })).toBe(50);
  });

  it('accounts for container offset', () => {
    expect(pointerXToPercent(150, { left: 50, width: 200 })).toBe(50);
  });

  it('clamps to [0,100] when pointer leaves the container', () => {
    expect(pointerXToPercent(-100, { left: 0, width: 200 })).toBe(0);
    expect(pointerXToPercent(999, { left: 0, width: 200 })).toBe(100);
  });

  it('returns 50 when width is zero', () => {
    expect(pointerXToPercent(100, { left: 0, width: 0 })).toBe(50);
  });
});

describe('nextSliderPercent', () => {
  it('moves left by default step on ArrowLeft', () => {
    expect(nextSliderPercent('ArrowLeft', 50)).toBe(49);
  });

  it('moves right by default step on ArrowRight', () => {
    expect(nextSliderPercent('ArrowRight', 50)).toBe(51);
  });

  it('uses big step when shift is held', () => {
    expect(nextSliderPercent('ArrowRight', 50, { shift: true })).toBe(60);
    expect(nextSliderPercent('ArrowLeft', 50, { shift: true })).toBe(40);
  });

  it('jumps to 0 on Home and 100 on End', () => {
    expect(nextSliderPercent('Home', 42)).toBe(0);
    expect(nextSliderPercent('End', 42)).toBe(100);
  });

  it('clamps to [0,100] at the edges', () => {
    expect(nextSliderPercent('ArrowLeft', 0)).toBe(0);
    expect(nextSliderPercent('ArrowRight', 100)).toBe(100);
  });

  it('returns null for unhandled keys', () => {
    expect(nextSliderPercent('Enter', 50)).toBeNull();
    expect(nextSliderPercent('a', 50)).toBeNull();
  });

  it('honours custom step sizes', () => {
    expect(nextSliderPercent('ArrowRight', 10, { step: 5 })).toBe(15);
    expect(nextSliderPercent('ArrowRight', 10, { shift: true, bigStep: 25 })).toBe(35);
  });
});
