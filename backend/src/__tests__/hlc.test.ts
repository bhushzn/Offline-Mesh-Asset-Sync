// ============================================================
// TacSync Backend — HLC Unit Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  hlcNow,
  hlcToString,
  hlcFromString,
  compareHLC,
  hlcZero,
  hlcMax,
} from '../crdt/hlc.js';

describe('Hybrid Logical Clock (HLC)', () => {
  it('should generate valid HLC timestamps', () => {
    const clock = hlcNow();
    expect(clock.ts).toBeGreaterThan(0);
    expect(clock.counter).toBe(0);
    expect(typeof clock.nodeId).toBe('string');
  });

  it('should serialize and parse correctly', () => {
    const clock = {
      ts: 1715000000000,
      counter: 42,
      nodeId: 'alpha-device-1',
    };

    const str = hlcToString(clock);
    const parsed = hlcFromString(str);

    expect(parsed.ts).toBe(clock.ts);
    expect(parsed.counter).toBe(clock.counter);
    expect(parsed.nodeId).toBe(clock.nodeId);
  });

  it('should compare physical time first', () => {
    const clock1 = { ts: 1000, counter: 5, nodeId: 'node-A' };
    const clock2 = { ts: 2000, counter: 1, nodeId: 'node-A' };

    expect(compareHLC(clock1, clock2)).toBeLessThan(0);
    expect(compareHLC(clock2, clock1)).toBeGreaterThan(0);
  });

  it('should compare logical counter when physical times are equal', () => {
    const clock1 = { ts: 1000, counter: 5, nodeId: 'node-A' };
    const clock2 = { ts: 1000, counter: 10, nodeId: 'node-A' };

    expect(compareHLC(clock1, clock2)).toBeLessThan(0);
    expect(compareHLC(clock2, clock1)).toBeGreaterThan(0);
  });

  it('should break ties with node ID lexicographically', () => {
    const clockA = { ts: 1000, counter: 5, nodeId: 'node-A' };
    const clockB = { ts: 1000, counter: 5, nodeId: 'node-B' };

    expect(compareHLC(clockA, clockB)).toBeLessThan(0);
    expect(compareHLC(clockB, clockA)).toBeGreaterThan(0);
  });

  it('should return 0 for identical clocks', () => {
    const clock1 = { ts: 1000, counter: 5, nodeId: 'node-A' };
    const clock2 = { ts: 1000, counter: 5, nodeId: 'node-A' };

    expect(compareHLC(clock1, clock2)).toBe(0);
  });

  it('should correctly handle hlcZero', () => {
    const zero = hlcZero();
    expect(zero.ts).toBe(0);
    expect(zero.counter).toBe(0);
    expect(zero.nodeId).toBe('');
  });

  it('should correctly calculate hlcMax', () => {
    const clock1 = { ts: 1000, counter: 10, nodeId: 'A' };
    const clock2 = { ts: 2000, counter: 1, nodeId: 'B' };

    const max = hlcMax(clock1, clock2);
    expect(max).toBe(clock2);
  });
});
