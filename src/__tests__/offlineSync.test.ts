import { describe, it, expect } from 'vitest';
import { CRDTEngine, HybridLogicalClock } from '../services/crdtService';
import { CRDTOperation, Asset, RollCallRecord, ChecklistExecution } from '../types/tactical';

describe('FIELDLINK Offline Synchronization & CRDT Core Verification', () => {
  // Test 1: Vector Clock Delta Calculation
  it('should accurately calculate missing delta operations using Vector Clocks', () => {
    const localOps: CRDTOperation[] = [
      {
        id: 'op-1',
        entityType: 'asset',
        entityId: 'asset-01',
        operationType: 'CREATE',
        payload: { name: 'Thermal Scope' },
        vectorClock: { 'device-a17': 1 },
        lamportClock: 1,
        hlcTimestamp: '1000-0-device-a17',
        timestamp: 1000,
        originDeviceId: 'device-a17',
        syncedWithPeers: [],
        hash: 'hash-1',
      },
      {
        id: 'op-2',
        entityType: 'asset',
        entityId: 'asset-01',
        operationType: 'UPDATE',
        payload: { status: 'Deployed' },
        vectorClock: { 'device-a17': 2 },
        lamportClock: 2,
        hlcTimestamp: '1002-0-device-a17',
        timestamp: 1002,
        originDeviceId: 'device-a17',
        syncedWithPeers: [],
        hash: 'hash-2',
      },
      {
        id: 'op-3',
        entityType: 'personnel',
        entityId: 'pers-01',
        operationType: 'UPDATE',
        payload: { status: 'Deployed' },
        vectorClock: { 'device-b04': 1 },
        lamportClock: 1,
        hlcTimestamp: '1001-0-device-b04',
        timestamp: 1001,
        originDeviceId: 'device-b04',
        syncedWithPeers: [],
        hash: 'hash-3',
      }
    ];

    // Remote peer has seen device-a17 up to clock 1, and device-b04 up to clock 1
    const remoteVectorClock = {
      'device-a17': 1,
      'device-b04': 1,
    };

    const missing = CRDTEngine.calculateMissingOps(localOps, remoteVectorClock);

    // Only op-2 (device-a17 at lamportClock 2) should be sent
    expect(missing.length).toBe(1);
    expect(missing[0].id).toBe('op-2');
  });

  // Test 2: Deterministic Tie-Breaker on Equal Timestamps
  it('should break ties deterministically using origin device ID when timestamps and lamport clocks match exactly', () => {
    const localAsset: Asset = {
      id: 'asset-100',
      customId: 'RAD-100',
      name: 'PRC-152 Tactical Radio',
      category: 'Comms',
      condition: 'Good',
      status: 'Available',
      assignment: 'Alpha Base',
      sector: 'Sector 1',
      serialNumber: 'SN-100',
      notes: 'Initial',
      version: 1,
      lamportClock: 5,
      hlcTimestamp: '5000-0-device-a17',
      updatedAt: 5000,
      updatedByDeviceId: 'device-a17',
      syncStatus: 'synced',
    };

    const remoteAsset: Asset = {
      id: 'asset-100',
      customId: 'RAD-100',
      name: 'PRC-152 Tactical Radio',
      category: 'Comms',
      condition: 'Good',
      status: 'Deployed',
      assignment: 'Bravo Lead',
      sector: 'Sector 2',
      serialNumber: 'SN-100',
      notes: 'Checked out concurrently',
      version: 1,
      lamportClock: 5,
      hlcTimestamp: '5000-0-device-b04',
      updatedAt: 5000,
      updatedByDeviceId: 'device-b04',
      syncStatus: 'pending',
    };

    // 'device-b04' > 'device-a17' lexicographically
    const result = CRDTEngine.mergeLWWEntity(localAsset, remoteAsset, 'device-a17');
    expect(result.winnerOrigin).toBe('device-b04');
    expect(result.mergedData.status).toBe('Deployed');
    expect(result.hasConflict).toBe(true);
    expect(result.conflictRecord).toBeDefined();
  });

  // Test 3: Roll Call Monotonic Merge
  it('should merge Roll Call muster records monotonically without losing entries', () => {
    const localRollCall: RollCallRecord = {
      id: 'rc-01',
      title: 'Alpha Fireteam Muster',
      sector: 'Sector North',
      startedAt: 1000,
      operatorName: 'Capt. Miller',
      deviceId: 'device-a17',
      status: 'In Progress',
      entries: {
        'pers-1': { personnelId: 'pers-1', personnelName: 'Sgt. Barnes', status: 'Present', timestamp: 1005 },
        'pers-2': { personnelId: 'pers-2', personnelName: 'Cpl. Vance', status: 'Missing', timestamp: 1005 },
      },
      summary: { total: 2, present: 1, absent: 0, missing: 1, injured: 0, other: 0 },
      version: 1,
      lamportClock: 2,
      updatedAt: 1005,
      updatedByDeviceId: 'device-a17',
      syncStatus: 'synced',
    };

    const incomingRollCall: RollCallRecord = {
      id: 'rc-01',
      title: 'Alpha Fireteam Muster',
      sector: 'Sector North',
      startedAt: 1000,
      operatorName: 'Capt. Miller',
      deviceId: 'device-b04',
      status: 'In Progress',
      entries: {
        // Cpl. Vance was verified Present by Patrol B at timestamp 1020
        'pers-2': { personnelId: 'pers-2', personnelName: 'Cpl. Vance', status: 'Present', timestamp: 1020 },
        // New entry for pers-3
        'pers-3': { personnelId: 'pers-3', personnelName: 'Pvt. Jackson', status: 'Present', timestamp: 1010 },
      },
      summary: { total: 2, present: 2, absent: 0, missing: 0, injured: 0, other: 0 },
      version: 2,
      lamportClock: 3,
      updatedAt: 1020,
      updatedByDeviceId: 'device-b04',
      syncStatus: 'pending',
    };

    const result = CRDTEngine.mergeRollCall(localRollCall, incomingRollCall);
    const merged = result.mergedData;

    expect(merged.entries['pers-1'].status).toBe('Present');
    expect(merged.entries['pers-2'].status).toBe('Present'); // updated from Missing to Present by newer timestamp
    expect(merged.entries['pers-3'].status).toBe('Present');
    expect(merged.summary.total).toBe(3);
    expect(merged.summary.present).toBe(3);
  });

  // Test 4: Checklist Execution State Merge
  it('should merge Checklist executions deterministically preserving completed items', () => {
    const localChecklist: ChecklistExecution = {
      id: 'chk-01',
      title: 'Pre-Flight UAV Scan',
      category: 'Vehicle Check',
      status: 'In Progress',
      items: [
        { id: 'item-1', label: 'Battery Check', completed: true, completedAt: 1000 },
        { id: 'item-2', label: 'Propeller Check', completed: false },
      ],
      progress: { completed: 1, total: 2 },
      version: 1,
      lamportClock: 1,
      updatedAt: 1000,
      updatedByDeviceId: 'device-a17',
      syncStatus: 'synced',
    };

    const incomingChecklist: ChecklistExecution = {
      id: 'chk-01',
      title: 'Pre-Flight UAV Scan',
      category: 'Vehicle Check',
      status: 'In Progress',
      items: [
        { id: 'item-1', label: 'Battery Check', completed: true, completedAt: 1000 },
        { id: 'item-2', label: 'Propeller Check', completed: true, completedAt: 1050 },
      ],
      progress: { completed: 2, total: 2 },
      version: 2,
      lamportClock: 2,
      updatedAt: 1050,
      updatedByDeviceId: 'device-b04',
      syncStatus: 'pending',
    };

    const result = CRDTEngine.mergeChecklist(localChecklist, incomingChecklist);
    const merged = result.mergedData;

    expect(merged.progress.completed).toBe(2);
    expect(merged.status).toBe('Completed');
    expect(merged.items.every(i => i.completed)).toBe(true);
  });
});
