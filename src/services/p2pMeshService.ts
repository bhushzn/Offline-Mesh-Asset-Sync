// ============================================================
// FIELDLINK — Real P2P Mesh Network & Transport Coordinator
// ============================================================

import { 
  OperatingMode, 
  PeerNode, 
  SyncMessage, 
  SyncMessageType, 
  TransportCapabilities, 
  TransportType 
} from '../types/tactical';
import { encryptMeshPayload, decryptMeshPayload, EncryptedPayload, sha256Hex } from '../utils/crypto';
import { TransportManager } from './transports/TransportManager';
import { MeshRouter } from './meshRouter';
import { auditLog } from './auditLogService';

type PeerListener = (peers: PeerNode[]) => void;
type SyncMsgListener = (msg: SyncMessage) => void;

class P2PMeshService {
  private transportManager: TransportManager;
  private meshRouter: MeshRouter;
  private localDeviceId = 'device-a17';
  private localDeviceName = 'A-17 / NORTH NODE';
  private localRole = 'Field Lead';
  private peerListeners: Set<PeerListener> = new Set();
  private msgListeners: Set<SyncMsgListener> = new Set();
  private encryptionEnabled = true;
  private mode: OperatingMode = 'FIELD_MODE';

  constructor() {
    const defaultWs = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? `ws://${window.location.hostname}:3001/ws/mesh`
      : 'wss://offline-mesh-asset-sync-production.up.railway.app/ws/mesh';
    const wsUrl = (import.meta as any).env?.VITE_WS_URL || defaultWs;

    this.transportManager = new TransportManager(this.localDeviceId, wsUrl);
    this.meshRouter = new MeshRouter(this.localDeviceId);

    // Subscribe to incoming transport messages
    this.transportManager.subscribeMessages(async (rawMsg, peerId, transportType) => {
      await this.handleIncomingRawMessage(rawMsg, peerId, transportType);
    });

    // Subscribe to peer list changes
    this.transportManager.subscribePeers((peers) => {
      this.notifyPeers(peers);
    });

    // Start periodic discovery beacon (HELLO packet)
    this.startDiscoveryBeacon();
  }

  public setMode(mode: OperatingMode) {
    this.mode = mode;
    this.transportManager.setMode(mode);
    if (mode === 'DEMO_MODE') {
      this.initSimulatedDemoPeers();
    }
  }

  public getMode(): OperatingMode {
    return this.mode;
  }

  public getTransportCapabilities(): TransportCapabilities[] {
    return this.transportManager.getTransportCapabilities();
  }

  public isBLEAvailable(): boolean {
    const caps = this.getTransportCapabilities();
    const ble = caps.find(c => c.type === 'BLE');
    return ble ? ble.isAvailable : false;
  }

  public isEncryptionActive(): boolean {
    return this.encryptionEnabled;
  }

  public setEncryption(enabled: boolean) {
    this.encryptionEnabled = enabled;
  }

  public setLocalDevice(deviceId: string, deviceName: string, role: string) {
    this.localDeviceId = deviceId;
    this.localDeviceName = deviceName;
    this.localRole = role;
  }

  public getPeers(): PeerNode[] {
    return this.transportManager.getPeers();
  }

  public getDiscoveredPeers(): PeerNode[] {
    return this.getPeers();
  }

  public subscribePeers(listener: PeerListener): () => void {
    this.peerListeners.add(listener);
    listener(this.getPeers());
    return () => this.peerListeners.delete(listener);
  }

  public subscribeMessages(listener: SyncMsgListener): () => void {
    this.msgListeners.add(listener);
    return () => this.msgListeners.delete(listener);
  }

  /**
   * Broadcasts a typed Sync Protocol message across all active mesh transports.
   */
  public async broadcast(
    type: SyncMessageType | any, 
    payload?: any, 
    vectorClock: Record<string, number> = {},
    hlcTimestamp: string = ''
  ): Promise<number> {
    // Support legacy object argument or structured parameters
    let finalType: SyncMessageType = 'OPERATION_BATCH';
    let finalPayload: any = payload;
    let finalVc = vectorClock;
    let finalHlc = hlcTimestamp;

    if (typeof type === 'object' && type !== null) {
      finalType = (type.type as SyncMessageType) || 'OPERATION';
      finalPayload = type;
      finalVc = type.vectorClock || {};
      finalHlc = type.hlcTimestamp || '';
    } else {
      finalType = type;
    }

    const msg: SyncMessage = {
      msgId: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: finalType,
      senderDeviceId: this.localDeviceId,
      timestamp: Date.now(),
      vectorClock: finalVc,
      hlcTimestamp: finalHlc,
      payload: finalPayload,
    };

    let packetToSend: any = msg;
    if (this.encryptionEnabled) {
      try {
        const encrypted = await encryptMeshPayload(msg);
        packetToSend = {
          isEncrypted: true,
          encrypted,
          senderDeviceId: this.localDeviceId,
          timestamp: Date.now(),
        };
      } catch (err) {
        console.warn('[Mesh] Encryption error, sending plain:', err);
      }
    }

    const meshPacket = await this.meshRouter.createPacket(packetToSend, 'BROADCAST');
    return await this.transportManager.broadcast(meshPacket);
  }

  /**
   * Sends a targeted Sync Protocol message to a specific peer.
   */
  public async sendToPeer(
    targetPeerId: string, 
    type: SyncMessageType | any, 
    payload?: any, 
    vectorClock: Record<string, number> = {},
    hlcTimestamp: string = ''
  ): Promise<boolean> {
    let finalType: SyncMessageType = 'SYNC_REQUEST';
    let finalPayload: any = payload;
    let finalVc = vectorClock;
    let finalHlc = hlcTimestamp;

    if (typeof type === 'object' && type !== null) {
      finalType = (type.type as SyncMessageType) || 'OPERATION';
      finalPayload = type;
      finalVc = type.vectorClock || {};
      finalHlc = type.hlcTimestamp || '';
    } else {
      finalType = type;
    }

    const msg: SyncMessage = {
      msgId: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: finalType,
      senderDeviceId: this.localDeviceId,
      targetDeviceId: targetPeerId,
      timestamp: Date.now(),
      vectorClock: finalVc,
      hlcTimestamp: finalHlc,
      payload: finalPayload,
    };

    let packetToSend: any = msg;
    if (this.encryptionEnabled) {
      try {
        const encrypted = await encryptMeshPayload(msg);
        packetToSend = {
          isEncrypted: true,
          encrypted,
          senderDeviceId: this.localDeviceId,
          targetDeviceId: targetPeerId,
          timestamp: Date.now(),
        };
      } catch (err) {
        console.warn('[Mesh] Encryption error, sending plain:', err);
      }
    }

    const meshPacket = await this.meshRouter.createPacket(packetToSend, targetPeerId);
    return await this.transportManager.sendToPeer(targetPeerId, meshPacket);
  }

  private async handleIncomingRawMessage(raw: any, peerId: string, transportType: TransportType) {
    if (!raw) return;

    let payloadToProcess = raw;
    if (raw.packetId && raw.path) {
      const routing = await this.meshRouter.processIncomingPacket(raw);
      if (!routing.shouldDeliver && !routing.shouldForward) {
        return;
      }

      if (routing.shouldForward && routing.packetToForward) {
        auditLog.log({
          deviceId: this.localDeviceId,
          eventType: 'PACKET_FORWARDED',
          details: `Forwarded store-and-forward packet ${raw.packetId} (Hop ${raw.hopCount})`,
          severity: 'INFO',
        });
        await this.transportManager.broadcast(routing.packetToForward);
      }

      if (!routing.shouldDeliver) {
        return;
      }
      payloadToProcess = raw.payload;
    }

    let finalMsg: SyncMessage;
    if (payloadToProcess && payloadToProcess.isEncrypted && payloadToProcess.encrypted) {
      try {
        finalMsg = await decryptMeshPayload<SyncMessage>(payloadToProcess.encrypted);
      } catch (err) {
        console.warn('[Mesh] Failed to decrypt mesh payload:', err);
        return;
      }
    } else {
      finalMsg = payloadToProcess as SyncMessage;
    }

    if (!finalMsg || !finalMsg.type || finalMsg.senderDeviceId === this.localDeviceId) {
      return;
    }

    if (finalMsg.type === 'HELLO') {
      this.sendToPeer(finalMsg.senderDeviceId, 'CAPABILITIES', {
        deviceName: this.localDeviceName,
        role: this.localRole,
      });
    }

    for (const listener of this.msgListeners) {
      listener(finalMsg);
    }
  }

  private startDiscoveryBeacon() {
    if (typeof window === 'undefined') return;
    setInterval(() => {
      this.broadcast('HELLO', {
        deviceName: this.localDeviceName,
        role: this.localRole,
      });
    }, 15000);
  }

  private initSimulatedDemoPeers() {
    if (this.mode !== 'DEMO_MODE') return;
    
    const demoPeers: PeerNode[] = [
      {
        deviceId: 'node-b04',
        deviceName: 'B-04 / DELTA PATROL',
        role: 'Patrol Lead',
        nodeType: 'Delta Patrol',
        rssi: -58,
        status: 'online',
        lastSyncAt: Date.now() - 32000,
        latencyMs: 18,
        connectionType: 'WebRTC',
        isSimulated: true,
        isTrusted: true,
        batteryLevel: 61,
        position3D: [35, 12, -20],
      },
      {
        deviceId: 'node-m08',
        deviceName: 'M-08 / MEDICAL SQUAD',
        role: 'Combat Medic',
        nodeType: 'Relay Gateway',
        rssi: -74,
        status: 'online',
        lastSyncAt: Date.now() - 110000,
        latencyMs: 42,
        connectionType: 'BLE',
        isSimulated: true,
        isTrusted: true,
        batteryLevel: 18,
        position3D: [-30, -18, 25],
      },
      {
        deviceId: 'node-hq01',
        deviceName: 'HQ-01 / COMMAND HUB',
        role: 'Tactical Command',
        nodeType: 'Command Hub',
        rssi: -42,
        status: 'online',
        lastSyncAt: Date.now() - 8000,
        latencyMs: 8,
        connectionType: 'Cloud',
        isSimulated: true,
        isTrusted: true,
        batteryLevel: 94,
        position3D: [0, 25, 0],
      },
    ];

    for (const p of demoPeers) {
      this.transportManager.addSimulatedPeer(p);
    }
  }

  private notifyPeers(peers: PeerNode[]) {
    for (const listener of this.peerListeners) {
      listener(peers);
    }
  }
}

export const p2pMesh = new P2PMeshService();
