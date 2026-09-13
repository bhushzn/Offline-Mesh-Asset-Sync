import { describe, it, expect } from 'vitest';
import { CRDTEngine, HybridLogicalClock } from '../services/crdtService';
import { canonicalJSON } from '../utils/crypto';
import { Asset } from '../types/tactical';

describe('FIELDLINK Tactical CRDT Engine & Clocks', () => {
  it('should deterministically stringify JSON regardless of key ordering', () => {
    const objA = { z: 1, a: 2, m: { y: 3, x: 4 } };
    const objB = { a: 2, z: 1, m: { x: 4, y: 3 } };

    expect(canonicalJSON(objA)).toBe(canonicalJSON(objB));
  });

  it('should compute identical SHA-256 hash for identical mutation operations', async () => {
    const opA = {
      id: 'op-101',
      entityType: 'asset' as const,
      entityId: 'asset-med01',
      operationType: 'UPDATE' as const,
      payload: { status: 'Deployed', assignment: 'Alpha Fireteam' },
      vectorClock: { 'device-a17': 2 },
      lamportClock: 2,
      hlcTimestamp: '1726000000000-0000-device-a17',
      timestamp: 1726000000000,
      originDeviceId: 'device-a17',
      syncedWithPeers: [],
    };

    const opB = { ...opA };

    const hashA = await CRDTEngine.computeOpHash(opA);
    const hashB = await CRDTEngine.computeOpHash(opB);

    expect(hashA).toBe(hashB);
    expect(hashA.length).toBe(64);
  });

  it('should resolve concurrent conflicting edits deterministically using HLC Lamport ordering', () => {
    const localAsset: Asset = {
      id: 'asset-701',
      customId: 'MED-701',
      name: 'Field Trauma Kit Alpha',
      category: 'Medical',
      condition: 'Good',
      status: 'Available',
      assignment: 'Base Hub',
      sector: 'Base Alpha',
      serialNumber: 'SN-001',
      notes: 'Initial state',
      version: 1,
      lamportClock: 2,
      hlcTimestamp: '1000000-0000-device-a17',
      updatedAt: 1000000,
      updatedByDeviceId: 'device-a17',
      syncStatus: 'synced',
    };

    // Remote node B edited asset at higher logical clock timestamp
    const remoteAsset: Asset = {
      id: 'asset-701',
      customId: 'MED-701',
      name: 'Field Trauma Kit Alpha (Field Deployed)',
      category: 'Medical',
      condition: 'Operational',
      status: 'Deployed',
      assignment: 'Alpha Fireteam Lead',
      sector: 'Sector 4 Ridge',
      serialNumber: 'SN-001',
      notes: 'Checked out for field operation',
      version: 2,
      lamportClock: 4,
      hlcTimestamp: '1000050-0000-device-b04',
      updatedAt: 1000050,
      updatedByDeviceId: 'device-b04',
      syncStatus: 'pending',
    };

    const result = CRDTEngine.mergeLWWEntity(localAsset, remoteAsset, 'device-a17');
    expect(result.mergedData.status).toBe('Deployed');
    expect(result.mergedData.assignment).toBe('Alpha Fireteam Lead');
    expect(result.winnerOrigin).toBe('device-b04');
  });

  it('should advance and update Hybrid Logical Clocks correctly', () => {
    const hlcA = new HybridLogicalClock('device-a17');
    const time1 = hlcA.now();
    const time2 = hlcA.now();

    expect(HybridLogicalClock.compare(time2, time1)).toBeGreaterThanOrEqual(0);

    const remoteHlc = 'zzzzzz-0005-device-b04';
    const advancedTime = hlcA.update(remoteHlc);
    expect(HybridLogicalClock.compare(advancedTime, remoteHlc)).toBeGreaterThanOrEqual(0);
  });
});
