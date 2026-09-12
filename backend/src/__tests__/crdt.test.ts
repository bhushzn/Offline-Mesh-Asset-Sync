// ============================================================
// TacSync Backend — CRDT & Conflict Resolution Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { resolveConflict, detectConflict } from '../crdt/conflictResolver.js';
import { hlcToString } from '../crdt/hlc.js';
import type { SyncOp } from '../crdt/conflictResolver.js';

describe('CRDT Conflict Resolver', () => {
  const opBase: SyncOp = {
    operationId: 'op-1',
    deviceId: 'device-alpha',
    entityType: 'asset',
    entityId: 'asset-100',
    operationType: 'UPDATE',
    data: { name: 'Thermal Scope', condition: 'DAMAGED', location: 'Alpha Camp' },
    hlcTimestamp: hlcToString({ ts: 1000, counter: 0, nodeId: 'device-alpha' }),
    version: 1,
  };

  it('should detect conflict when two devices update the same entity with different timestamps', () => {
    const opIncoming: SyncOp = {
      ...opBase,
      operationId: 'op-2',
      deviceId: 'device-bravo',
      data: { name: 'Thermal Scope', condition: 'SERVICEABLE', location: 'Bravo Post' },
      hlcTimestamp: hlcToString({ ts: 2000, counter: 0, nodeId: 'device-bravo' }),
    };

    expect(detectConflict(opIncoming, opBase)).toBe(true);
  });

  it('should not detect conflict if operations are from the same device', () => {
    const opIncoming: SyncOp = {
      ...opBase,
      operationId: 'op-3',
      hlcTimestamp: hlcToString({ ts: 3000, counter: 0, nodeId: 'device-alpha' }),
    };

    expect(detectConflict(opIncoming, opBase)).toBe(false);
  });

  it('should resolve conflict using LWW (Last-Write-Wins) where newer HLC wins', () => {
    const opAlpha: SyncOp = {
      ...opBase,
      operationId: 'op-alpha',
      deviceId: 'device-alpha',
      data: { status: 'AVAILABLE', location: 'Alpha Ridge' },
      hlcTimestamp: hlcToString({ ts: 1000, counter: 0, nodeId: 'device-alpha' }),
    };

    const opBravo: SyncOp = {
      ...opBase,
      operationId: 'op-bravo',
      deviceId: 'device-bravo',
      data: { status: 'DEPLOYED', location: 'Bravo Ridge' },
      hlcTimestamp: hlcToString({ ts: 2000, counter: 0, nodeId: 'device-bravo' }),
    };

    const conflict = resolveConflict(opBravo, opAlpha);
    expect(conflict.winningOp.operationId).toBe('op-bravo');
    expect(conflict.mergedData.status).toBe('DEPLOYED');
  });

  it('should merge fields when updating non-overlapping properties', () => {
    const opAlpha: SyncOp = {
      ...opBase,
      operationId: 'op-alpha',
      deviceId: 'device-alpha',
      data: { notes: 'Inspected by Alpha Lead' },
      hlcTimestamp: hlcToString({ ts: 1000, counter: 0, nodeId: 'device-alpha' }),
    };

    const opBravo: SyncOp = {
      ...opBase,
      operationId: 'op-bravo',
      deviceId: 'device-bravo',
      data: { condition: 'UNDER_REPAIR' },
      hlcTimestamp: hlcToString({ ts: 2000, counter: 0, nodeId: 'device-bravo' }),
    };

    const conflict = resolveConflict(opBravo, opAlpha);
    expect(conflict.mergedData.condition).toBe('UNDER_REPAIR');
    expect(conflict.mergedData.notes).toBe('Inspected by Alpha Lead');
  });
});
