// FIELDLINK P2P Mesh Transport Service (BroadcastChannel + WebRTC DataChannels + BLE Abstraction)
import { PeerNode } from '../types/tactical';

export type MeshMessage = 
  | { type: 'DISCOVERY_PING'; deviceId: string; deviceName: string; role: string; vectorClock: Record<string, number>; timestamp: number }
  | { type: 'DISCOVERY_PONG'; deviceId: string; deviceName: string; role: string; vectorClock: Record<string, number>; timestamp: number }
  | { type: 'SYNC_REQUEST'; fromDeviceId: string; toDeviceId: string; vectorClock: Record<string, number> }
  | { type: 'SYNC_RESPONSE'; fromDeviceId: string; toDeviceId: string; ops: any[]; vectorClock: Record<string, number> }
  | { type: 'SYNC_ACK'; fromDeviceId: string; toDeviceId: string; syncedOpIds: string[] }
  | { type: 'WEBRTC_SIGNAL'; fromDeviceId: string; toDeviceId: string; sdp?: any; candidate?: any };

type PeerListener = (peers: PeerNode[]) => void;
type SyncMsgListener = (msg: MeshMessage) => void;

class P2PMeshService {
  private channel: BroadcastChannel | null = null;
  private localDeviceId = 'device-a17';
  private localDeviceName = 'A-17 / NORTH NODE';
  private localRole = 'Field Lead';
  private peers: Map<string, PeerNode> = new Map();
  private peerListeners: Set<PeerListener> = new Set();
  private msgListeners: Set<SyncMsgListener> = new Set();
  private rtcConnections: Map<string, RTCPeerConnection> = new Map();
  private rtcDataChannels: Map<string, RTCDataChannel> = new Map();
  private heartbeatTimer: any = null;
  private bleSupported = false;

  constructor() {
    this.checkCapabilities();
    this.initBroadcastChannel();
    this.initSimulatedMeshPeers();
  }

  private checkCapabilities() {
    this.bleSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  public isBLEAvailable(): boolean {
    return this.bleSupported;
  }

  private initBroadcastChannel() {
    try {
      this.channel = new BroadcastChannel('fieldlink_tactical_mesh');
      this.channel.onmessage = (event) => {
        this.handleIncomingMessage(event.data as MeshMessage);
      };
      this.startHeartbeat();
    } catch (e) {
      console.warn('BroadcastChannel not supported in this environment', e);
    }
  }

  private initSimulatedMeshPeers() {
    // Standard tactical nearby nodes for mesh visualization and local testing
    const defaultPeers: PeerNode[] = [
      {
        deviceId: 'device-b04',
        deviceName: 'B-04 / DELTA PATROL',
        role: 'Scout Lead',
        nodeType: 'Delta Patrol',
        rssi: -58,
        status: 'online',
        lastSyncAt: Date.now() - 1000 * 45,
        latencyMs: 14,
        connectionType: 'BroadcastChannel',
        position3D: [-2.5, 1.2, 0.8],
      },
      {
        deviceId: 'device-c12',
        deviceName: 'C-12 / RECON DRONE',
        role: 'Airborne Relay',
        nodeType: 'Relay Gateway',
        rssi: -72,
        status: 'online',
        lastSyncAt: Date.now() - 1000 * 120,
        latencyMs: 38,
        connectionType: 'WebRTC',
        position3D: [2.8, 2.0, -1.5],
      },
      {
        deviceId: 'device-r01',
        deviceName: 'R-01 / COMMAND RELAY',
        role: 'HQ Gateway',
        nodeType: 'Command Hub',
        rssi: -42,
        status: 'online',
        lastSyncAt: Date.now() - 1000 * 300,
        latencyMs: 8,
        connectionType: 'WebRTC',
        position3D: [0.2, -1.8, 2.2],
      },
      {
        deviceId: 'device-m08',
        deviceName: 'M-08 / MEDICAL OUTPOST',
        role: 'Field Triage',
        nodeType: 'Delta Patrol',
        rssi: -84,
        status: 'discovered',
        lastSyncAt: Date.now() - 1000 * 600,
        latencyMs: 52,
        connectionType: 'BLE_Simulated',
        position3D: [-1.8, -1.4, -2.0],
      }
    ];

    defaultPeers.forEach(p => this.peers.set(p.deviceId, p));
  }

  public setLocalIdentity(deviceId: string, deviceName: string, role: string) {
    this.localDeviceId = deviceId;
    this.localDeviceName = deviceName;
    this.localRole = role;
    this.broadcastDiscovery();
  }

  public startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.broadcastDiscovery();
    }, 10000);
    this.broadcastDiscovery();
  }

  public broadcastDiscovery() {
    this.sendMessage({
      type: 'DISCOVERY_PING',
      deviceId: this.localDeviceId,
      deviceName: this.localDeviceName,
      role: this.localRole,
      vectorClock: { [this.localDeviceId]: 1 },
      timestamp: Date.now(),
    });
  }

  public sendMessage(msg: MeshMessage) {
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (e) {
        console.error('Error posting mesh message:', e);
      }
    }
  }

  private handleIncomingMessage(msg: MeshMessage) {
    if (!msg || (msg as any).deviceId === this.localDeviceId || (msg as any).fromDeviceId === this.localDeviceId) {
      return; // Ignore own messages
    }

    if (msg.type === 'DISCOVERY_PING') {
      // Register or update peer
      const existing = this.peers.get(msg.deviceId);
      const updatedPeer: PeerNode = {
        deviceId: msg.deviceId,
        deviceName: msg.deviceName,
        role: msg.role,
        nodeType: 'Field Node',
        rssi: existing ? existing.rssi : -50 - Math.floor(Math.random() * 20),
        status: 'online',
        lastSyncAt: existing ? existing.lastSyncAt : Date.now(),
        latencyMs: 12 + Math.floor(Math.random() * 15),
        connectionType: 'BroadcastChannel',
        position3D: existing?.position3D || [
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 4,
        ],
      };
      this.peers.set(msg.deviceId, updatedPeer);
      this.notifyPeers();

      // Reply with PONG
      this.sendMessage({
        type: 'DISCOVERY_PONG',
        deviceId: this.localDeviceId,
        deviceName: this.localDeviceName,
        role: this.localRole,
        vectorClock: { [this.localDeviceId]: 1 },
        timestamp: Date.now(),
      });
    } else if (msg.type === 'DISCOVERY_PONG') {
      const existing = this.peers.get(msg.deviceId);
      const updatedPeer: PeerNode = {
        deviceId: msg.deviceId,
        deviceName: msg.deviceName,
        role: msg.role,
        nodeType: 'Field Node',
        rssi: existing ? existing.rssi : -55,
        status: 'online',
        lastSyncAt: existing ? existing.lastSyncAt : Date.now(),
        latencyMs: 15,
        connectionType: 'BroadcastChannel',
        position3D: existing?.position3D || [
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 4,
        ],
      };
      this.peers.set(msg.deviceId, updatedPeer);
      this.notifyPeers();
    }

    // Pass to sync listeners
    this.msgListeners.forEach(listener => listener(msg));
  }

  public getDiscoveredPeers(): PeerNode[] {
    return Array.from(this.peers.values()).filter(p => p.deviceId !== this.localDeviceId);
  }

  public updatePeerStatus(deviceId: string, status: PeerNode['status'], lastSyncAt?: number) {
    const peer = this.peers.get(deviceId);
    if (peer) {
      peer.status = status;
      if (lastSyncAt) peer.lastSyncAt = lastSyncAt;
      this.notifyPeers();
    }
  }

  public subscribePeers(listener: PeerListener): () => void {
    this.peerListeners.add(listener);
    listener(this.getDiscoveredPeers());
    return () => this.peerListeners.delete(listener);
  }

  public subscribeMessages(listener: SyncMsgListener): () => void {
    this.msgListeners.add(listener);
    return () => this.msgListeners.delete(listener);
  }

  private notifyPeers() {
    const peerList = this.getDiscoveredPeers();
    this.peerListeners.forEach(cb => cb(peerList));
  }

  // WebRTC DataChannel connection initiator
  public async createWebRTCOffer(targetDeviceId: string): Promise<string> {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      const dc = pc.createDataChannel('fieldlink_mesh_dc');
      
      this.rtcConnections.set(targetDeviceId, pc);
      this.rtcDataChannels.set(targetDeviceId, dc);

      dc.onopen = () => {
        this.updatePeerStatus(targetDeviceId, 'online');
      };

      dc.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          this.handleIncomingMessage(msg);
        } catch {
          // ignore non-json
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      return JSON.stringify(offer);
    } catch (err) {
      console.warn('WebRTC offer failed:', err);
      return '';
    }
  }
}

export const p2pMesh = new P2PMeshService();
