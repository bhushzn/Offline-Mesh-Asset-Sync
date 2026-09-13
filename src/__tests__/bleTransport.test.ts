import { describe, it, expect, beforeEach } from 'vitest';
import { BLETransport } from '../services/transports/BLETransport';
import { MeshRouter } from '../services/meshRouter';
import { SyncMessage } from '../types/tactical';

describe('FIELDLINK Native BLE Transport & Mesh Routing', () => {
  let transport: BLETransport;

  beforeEach(() => {
    transport = new BLETransport('test-node-001', 'NODE-001');
  });

  it('should initialize with correct BLE transport capabilities', () => {
    const caps = transport.getCapabilities();
    expect(caps.type).toBe('BLE');
    expect(caps.mtuBytes).toBe(512);
    expect(caps.bandwidthKbps).toBe(64);
    expect(caps.latencyMs).toBe(120);
  });

  it('should format and chunk large payloads for BLE transmission', () => {
    const chunkSize = 180;
    const testPayload = JSON.stringify({
      type: 'OPERATION_BATCH',
      senderDeviceId: 'test-node-001',
      ops: Array.from({ length: 10 }, (_, i) => ({
        id: `op-${i}`,
        entityType: 'asset',
        data: `Tactical gear deployment sector ${i} status operational`,
      })),
    });

    const total = Math.ceil(testPayload.length / chunkSize);
    expect(total).toBeGreaterThan(1);

    const msgId = 'a1b2';
    const chunks: string[] = [];
    for (let i = 0; i < total; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, testPayload.length);
      chunks.push(`FLK:${msgId}:${i}:${total}:${testPayload.substring(start, end)}`);
    }

    expect(chunks.length).toBe(total);

    // Reassemble chunks
    const buffer = new Map<number, string>();
    for (const chunk of chunks) {
      let idx = 0;
      for (let i = 0; i < 4; i++) {
        idx = chunk.indexOf(':', idx) + 1;
      }
      const header = chunk.substring(0, idx - 1);
      const data = chunk.substring(idx);

      const headerParts = header.split(':');
      expect(headerParts[0]).toBe('FLK');
      expect(headerParts[1]).toBe(msgId);
      const seq = parseInt(headerParts[2]);
      const tot = parseInt(headerParts[3]);
      expect(tot).toBe(total);
      buffer.set(seq, data);
    }

    let reassembled = '';
    for (let i = 0; i < total; i++) {
      reassembled += buffer.get(i);
    }

    expect(reassembled).toBe(testPayload);
    const parsed = JSON.parse(reassembled);
    expect(parsed.ops.length).toBe(10);
  });

  it('should route packets across multi-hop store-and-forward mesh (Node A -> Node B -> Node C)', async () => {
    const routerA = new MeshRouter('node-A');
    const routerB = new MeshRouter('node-B');
    const routerC = new MeshRouter('node-C');

    const testMsg: SyncMessage = {
      msgId: 'msg-p2p-101',
      type: 'OPERATION_BATCH',
      senderDeviceId: 'node-A',
      targetDeviceId: 'node-C',
      timestamp: Date.now(),
      vectorClock: { 'node-A': 1 },
      hlcTimestamp: '1000-node-A',
      payload: { ops: [{ id: 'op-alpha', entityType: 'asset' }] },
    };

    // 1. Node A creates packet targeted to Node C
    const packetFromA = await routerA.createPacket(testMsg, 'node-C', 4);
    expect(packetFromA.originDeviceId).toBe('node-A');
    expect(packetFromA.destinationDeviceId).toBe('node-C');
    expect(packetFromA.hopCount).toBe(0);
    expect(packetFromA.ttl).toBe(4);
    expect(packetFromA.path).toEqual(['node-A']);

    // 2. Node B (intermediate relay) receives packet
    const routeB = await routerB.processIncomingPacket(packetFromA);
    expect(routeB.shouldDeliver).toBe(false); // Not for Node B
    expect(routeB.shouldForward).toBe(true);  // Must relay
    expect(routeB.packetToForward).toBeDefined();
    expect(routeB.packetToForward!.hopCount).toBe(1);
    expect(routeB.packetToForward!.ttl).toBe(3);
    expect(routeB.packetToForward!.path).toEqual(['node-A', 'node-B']);

    // 3. Node C (final destination) receives packet forwarded by Node B
    const routeC = await routerC.processIncomingPacket(routeB.packetToForward!);
    expect(routeC.shouldDeliver).toBe(true); // Delivered to Node C!
    expect(routeC.shouldForward).toBe(false); // Reached destination, no further forwarding

    // 4. Duplicate suppression test: Node B receives the same packet again
    const duplicateRouteB = await routerB.processIncomingPacket(packetFromA);
    expect(duplicateRouteB.shouldDeliver).toBe(false);
    expect(duplicateRouteB.shouldForward).toBe(false); // Dropped as duplicate!

    // 5. Loop prevention: Node A receives packet that already passed through Node A
    const loopRouteA = await routerA.processIncomingPacket(routeB.packetToForward!);
    expect(loopRouteA.shouldDeliver).toBe(false);
    expect(loopRouteA.shouldForward).toBe(false); // Dropped because Node A is in path
  });
});
