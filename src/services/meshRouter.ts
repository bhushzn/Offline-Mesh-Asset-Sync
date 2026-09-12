import { MeshPacket, SyncMessage } from '../types/tactical';
import { sha256Hex } from '../utils/crypto';

export interface RouteStats {
  packetsReceived: number;
  packetsForwarded: number;
  packetsDelivered: number;
  duplicatesDropped: number;
  expiredDropped: number;
}

export class MeshRouter {
  private localDeviceId: string;
  private seenPacketCache = new Set<string>();
  private cacheExpiryQueue: { id: string; time: number }[] = [];
  private stats: RouteStats = {
    packetsReceived: 0,
    packetsForwarded: 0,
    packetsDelivered: 0,
    duplicatesDropped: 0,
    expiredDropped: 0,
  };

  constructor(localDeviceId: string) {
    this.localDeviceId = localDeviceId;
  }

  public async createPacket(
    payload: SyncMessage,
    destinationDeviceId: string = 'BROADCAST',
    maxTTL: number = 4
  ): Promise<MeshPacket> {
    const timestamp = Date.now();
    const packetId = `pkt-${this.localDeviceId}-${timestamp}-${Math.random().toString(36).substring(2, 7)}`;
    const hash = await sha256Hex({ packetId, payload, timestamp, origin: this.localDeviceId });

    const packet: MeshPacket = {
      packetId,
      originDeviceId: this.localDeviceId,
      destinationDeviceId,
      ttl: maxTTL,
      hopCount: 0,
      path: [this.localDeviceId],
      payload,
      timestamp,
      hash,
    };

    this.markSeen(packet.packetId);
    return packet;
  }

  public async processIncomingPacket(
    packet: MeshPacket
  ): Promise<{ shouldDeliver: boolean; shouldForward: boolean; packetToForward?: MeshPacket }> {
    this.stats.packetsReceived++;
    this.cleanExpiredCache();

    // 1. Duplicate Suppression
    if (this.seenPacketCache.has(packet.packetId)) {
      this.stats.duplicatesDropped++;
      return { shouldDeliver: false, shouldForward: false };
    }
    this.markSeen(packet.packetId);

    // 2. Loop detection (if path already contains localDeviceId)
    if (packet.path.includes(this.localDeviceId) && packet.originDeviceId !== this.localDeviceId) {
      this.stats.duplicatesDropped++;
      return { shouldDeliver: false, shouldForward: false };
    }

    // 3. TTL Check
    if (packet.ttl <= 0) {
      this.stats.expiredDropped++;
      return { shouldDeliver: false, shouldForward: false };
    }

    const isForMe = packet.destinationDeviceId === 'BROADCAST' || packet.destinationDeviceId === this.localDeviceId;
    if (isForMe) {
      this.stats.packetsDelivered++;
    }

    // Check if we should forward (store-and-forward relay)
    const shouldForward = packet.destinationDeviceId !== this.localDeviceId && packet.ttl > 1;

    let forwardedPacket: MeshPacket | undefined;
    if (shouldForward) {
      this.stats.packetsForwarded++;
      forwardedPacket = {
        ...packet,
        ttl: packet.ttl - 1,
        hopCount: packet.hopCount + 1,
        path: [...packet.path, this.localDeviceId],
      };
    }

    return {
      shouldDeliver: isForMe,
      shouldForward,
      packetToForward: forwardedPacket,
    };
  }

  public getStats(): RouteStats {
    return { ...this.stats };
  }

  private markSeen(packetId: string) {
    this.seenPacketCache.add(packetId);
    this.cacheExpiryQueue.push({ id: packetId, time: Date.now() });
    if (this.seenPacketCache.size > 5000) {
      this.cleanExpiredCache(true);
    }
  }

  private cleanExpiredCache(force: boolean = false) {
    const now = Date.now();
    const TTL_MS = 60000; // 1 minute seen cache
    while (this.cacheExpiryQueue.length > 0) {
      const item = this.cacheExpiryQueue[0];
      if (force || now - item.time > TTL_MS) {
        this.cacheExpiryQueue.shift();
        this.seenPacketCache.delete(item.id);
      } else {
        break;
      }
    }
  }
}
