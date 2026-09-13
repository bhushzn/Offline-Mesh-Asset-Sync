import { IMeshTransport } from './MeshTransport';
import { WebRTCTransport } from './WebRTCTransport';
import { BLETransport } from './BLETransport';
import { LocalNetworkTransport } from './LocalNetworkTransport';
import { CloudTransport } from './CloudTransport';
import { LocalSignalingClient, SignalingPeerInfo } from './LocalSignalingClient';
import { OperatingMode, PeerNode, TransportCapabilities, TransportStatus, TransportType } from '../../types/tactical';

export interface NetworkDiagnostics {
  internet: 'ONLINE' | 'OFFLINE';
  localSignaling: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  webrtc: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'NO_PEERS';
  mesh: 'ACTIVE' | 'INACTIVE';
  cloud: 'ONLINE' | 'DISABLED' | 'UNAVAILABLE';
  activePeersCount: number;
  pendingOpsCount: number;
  lastSyncTime: number | null;
  signalingUrl: string;
}

export class TransportManager {
  private transports: Map<TransportType, IMeshTransport> = new Map();
  private signalingClient: LocalSignalingClient;
  private webrtcTransport: WebRTCTransport;
  private peers: Map<string, PeerNode> = new Map();
  private mode: OperatingMode = 'FIELD_MODE';
  private localDeviceId: string;
  private localDeviceName: string;
  private localRole: string;
  private messageListeners = new Set<(message: any, peerId: string, transport: TransportType) => void>();
  private peerListeners = new Set<(peers: PeerNode[]) => void>();
  private diagListeners = new Set<(diag: NetworkDiagnostics) => void>();

  constructor(localDeviceId: string, defaultWsUrl: string) {
    this.localDeviceId = localDeviceId;
    this.localDeviceName = (typeof localStorage !== 'undefined' && localStorage.getItem('fieldlink_device_name')) || `Node-${localDeviceId.slice(0, 5)}`;
    this.localRole = 'Field Operator';

    // 1. Initialize Local LAN Signaling Client (for offline WebRTC discovery)
    this.signalingClient = new LocalSignalingClient(
      localDeviceId,
      this.localDeviceName,
      this.localRole
    );

    // 2. Initialize WebRTC Transport (Primary direct P2P data channel)
    this.webrtcTransport = new WebRTCTransport(
      localDeviceId,
      (targetPeerId, signal) => {
        // Send WebRTC signals over Local LAN signaling client (and BroadcastChannel for multi-tab)
        this.signalingClient.sendSignal(targetPeerId, signal);
        this.transports.get('LocalNetwork')?.send(targetPeerId, {
          __webrtc_signal: signal,
          senderDeviceId: this.localDeviceId,
          targetDeviceId: targetPeerId,
          timestamp: Date.now()
        });
      },
      this.mode
    );
    this.transports.set('WebRTC', this.webrtcTransport);

    // 3. Initialize Local Network Transport (BroadcastChannel for same-browser dev)
    const localNet = new LocalNetworkTransport(localDeviceId);
    this.transports.set('LocalNetwork', localNet);

    // 4. Initialize BLE Transport (Optional Web Bluetooth)
    const ble = new BLETransport();
    this.transports.set('BLE', ble);

    // 5. Initialize Cloud Transport (Optional WebSocket relay for ONLINE_MODE only)
    const cloud = new CloudTransport(localDeviceId, defaultWsUrl);
    this.transports.set('Cloud', cloud);

    // Wire up Signaling Client events
    this.signalingClient.onSignal((signal, fromDeviceId) => {
      this.webrtcTransport.handleSignal(fromDeviceId, signal);
    });

    this.signalingClient.onPeerEvent((action, peer) => {
      if (action === 'PEER_JOINED') {
        this.handleLANPeerDiscovered(peer);
      } else if (action === 'PEER_LEFT') {
        this.handleLANPeerLeft(peer.deviceId);
      }
    });

    this.signalingClient.onStatusChange(() => {
      this.notifyDiagnostics();
    });

    // Wire up Transport listeners
    for (const [type, transport] of this.transports) {
      transport.onMessage((msg, peerId, transType) => {
        this.handleIncomingTransportMessage(msg, peerId, transType);
      });
      transport.onStateChange((peerId, status, transType) => {
        this.handleTransportStateChange(peerId, status, transType);
      });
    }

    // Set initial mode
    this.setMode(this.mode);
  }

  public setMode(newMode: OperatingMode) {
    this.mode = newMode;
    this.webrtcTransport.setMode(newMode);

    if (newMode === 'FIELD_MODE') {
      // In FIELD_MODE: Purge simulated peers
      for (const [id, peer] of Array.from(this.peers.entries())) {
        if (peer.isSimulated) {
          this.peers.delete(id);
        }
      }
    }
    this.notifyPeers();
    this.notifyDiagnostics();
  }

  public getMode(): OperatingMode {
    return this.mode;
  }

  public setSignalingServerUrl(url: string) {
    this.signalingClient.setServerUrl(url);
    this.notifyDiagnostics();
  }

  public getSignalingServerUrl(): string {
    return this.signalingClient.getServerUrl();
  }

  public getTransportCapabilities(): TransportCapabilities[] {
    return Array.from(this.transports.values()).map(t => t.getCapabilities());
  }

  public getPeers(): PeerNode[] {
    return Array.from(this.peers.values());
  }

  public subscribePeers(listener: (peers: PeerNode[]) => void): () => void {
    this.peerListeners.add(listener);
    listener(this.getPeers());
    return () => this.peerListeners.delete(listener);
  }

  public subscribeMessages(listener: (message: any, peerId: string, transport: TransportType) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public subscribeDiagnostics(listener: (diag: NetworkDiagnostics) => void): () => void {
    this.diagListeners.add(listener);
    listener(this.getDiagnostics());
    return () => this.diagListeners.delete(listener);
  }

  public getDiagnostics(): NetworkDiagnostics {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;
    const sigStatus = this.signalingClient.getStatus();
    const realPeers = Array.from(this.peers.values()).filter(p => !p.isSimulated);
    const connectedWebRTC = realPeers.filter(p => p.connectionType === 'WebRTC' && p.status === 'online');

    let webrtcStatus: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'NO_PEERS' = 'NO_PEERS';
    if (connectedWebRTC.length > 0) {
      webrtcStatus = 'CONNECTED';
    } else if (realPeers.some(p => p.status === 'syncing')) {
      webrtcStatus = 'CONNECTING';
    } else if (realPeers.length > 0) {
      webrtcStatus = 'DISCONNECTED';
    }

    const isMeshActive = realPeers.some(p => p.status === 'online') || (this.mode === 'DEMO_MODE');

    let cloudStatus: 'ONLINE' | 'DISABLED' | 'UNAVAILABLE' = 'DISABLED';
    if (this.mode !== 'FIELD_MODE') {
      const cloud = this.transports.get('Cloud');
      cloudStatus = cloud && cloud.getStatus() === 'connected' ? 'ONLINE' : 'UNAVAILABLE';
    }

    return {
      internet: isOnline ? 'ONLINE' : 'OFFLINE',
      localSignaling: sigStatus,
      webrtc: webrtcStatus,
      mesh: isMeshActive ? 'ACTIVE' : 'INACTIVE',
      cloud: cloudStatus,
      activePeersCount: realPeers.filter(p => p.status === 'online').length,
      pendingOpsCount: 0,
      lastSyncTime: Date.now(),
      signalingUrl: this.signalingClient.getServerUrl(),
    };
  }

  private notifyDiagnostics() {
    const diag = this.getDiagnostics();
    for (const listener of this.diagListeners) {
      listener(diag);
    }
  }

  public async broadcast(message: any): Promise<number> {
    let totalSent = 0;

    // 1. Primary: Send directly over WebRTC DataChannels
    const webrtcSent = await this.webrtcTransport.broadcast(message);
    totalSent += webrtcSent;

    // 2. BroadcastChannel for local development tabs
    const localSent = await this.transports.get('LocalNetwork')?.broadcast(message) || 0;
    if (totalSent === 0) totalSent += localSent;

    // 3. Cloud (Only in ONLINE_MODE)
    if (this.mode === 'ONLINE_MODE') {
      const cloudSent = await this.transports.get('Cloud')?.broadcast(message) || 0;
      totalSent += cloudSent;
    }

    return totalSent;
  }

  public async sendToPeer(peerId: string, message: any): Promise<boolean> {
    const peer = this.peers.get(peerId);

    // 1. If WebRTC connection is open to this peer, send directly
    if (this.webrtcTransport.isPeerConnected(peerId)) {
      const sent = await this.webrtcTransport.send(peerId, message);
      if (sent) return true;
    }

    // 2. Fallback to peer's specific connection type if available
    if (peer) {
      const transport = this.transports.get(peer.connectionType);
      if (transport && transport.type !== 'WebRTC') {
        const sent = await transport.send(peerId, message);
        if (sent) return true;
      }
    }

    // 3. Cloud fallback in ONLINE_MODE
    if (this.mode === 'ONLINE_MODE') {
      const cloud = this.transports.get('Cloud');
      if (cloud) {
        return await cloud.send(peerId, message);
      }
    }

    // 4. Same-browser BroadcastChannel fallback
    return (await this.transports.get('LocalNetwork')?.send(peerId, message)) || false;
  }

  public addSimulatedPeer(peer: PeerNode) {
    if (this.mode !== 'DEMO_MODE') return;
    this.peers.set(peer.deviceId, {
      ...peer,
      isSimulated: true,
    });
    this.notifyPeers();
  }

  public removeSimulatedPeer(peerId: string) {
    if (this.peers.has(peerId) && this.peers.get(peerId)?.isSimulated) {
      this.peers.delete(peerId);
      this.notifyPeers();
    }
  }

  private handleLANPeerDiscovered(peerInfo: SignalingPeerInfo) {
    const peerId = peerInfo.deviceId;
    if (peerId === this.localDeviceId) return;

    if (!this.peers.has(peerId)) {
      this.peers.set(peerId, {
        deviceId: peerId,
        deviceName: peerInfo.deviceName,
        role: peerInfo.role,
        nodeType: 'Delta Patrol',
        rssi: -45,
        status: 'syncing',
        lastSyncAt: Date.now(),
        latencyMs: 15,
        connectionType: 'WebRTC',
        isTrusted: true,
        isSimulated: false,
        batteryLevel: 90,
      });
      this.notifyPeers();
    }

    // Deterministic WebRTC negotiation:
    // The device with lexicographically greater deviceId acts as initiator
    if (this.localDeviceId > peerId) {
      this.webrtcTransport.connect(peerId).catch(() => {});
    }
  }

  private handleLANPeerLeft(peerId: string) {
    if (this.peers.has(peerId) && !this.peers.get(peerId)?.isSimulated) {
      const peer = this.peers.get(peerId)!;
      peer.status = 'disconnected';
      this.notifyPeers();
      this.notifyDiagnostics();
    }
  }

  private handleIncomingTransportMessage(msg: any, peerId: string, transportType: TransportType) {
    // 1. Handle WebRTC signaling envelope if received over BroadcastChannel
    if (msg && msg.__webrtc_signal) {
      this.webrtcTransport.handleSignal(msg.senderDeviceId || peerId, msg.__webrtc_signal);
      return;
    }

    // 2. Register or update peer presence
    if (msg && msg.senderDeviceId && msg.senderDeviceId !== this.localDeviceId) {
      const senderId = msg.senderDeviceId;
      const existing = this.peers.get(senderId);

      this.peers.set(senderId, {
        deviceId: senderId,
        deviceName: msg.deviceName || existing?.deviceName || `Node-${senderId.slice(0, 5)}`,
        role: msg.role || existing?.role || 'Field Operator',
        nodeType: msg.nodeType || existing?.nodeType || 'Relay Node',
        rssi: transportType === 'WebRTC' ? -42 : transportType === 'LocalNetwork' ? -30 : -68,
        status: 'online',
        lastSyncAt: Date.now(),
        latencyMs: transportType === 'WebRTC' ? 12 : 2,
        connectionType: transportType,
        isTrusted: true,
        isSimulated: false,
        batteryLevel: msg.batteryLevel || existing?.batteryLevel || 88,
      });
      this.notifyPeers();
      this.notifyDiagnostics();
    }

    // 3. Dispatch to message listeners
    for (const listener of this.messageListeners) {
      listener(msg, peerId, transportType);
    }
  }

  private handleTransportStateChange(peerId: string, status: TransportStatus, transportType: TransportType) {
    const peer = this.peers.get(peerId);
    if (peer && !peer.isSimulated) {
      peer.status = status === 'connected' ? 'online' : status === 'connecting' ? 'syncing' : 'disconnected';
      peer.connectionType = transportType;
      this.notifyPeers();
      this.notifyDiagnostics();
    }
  }

  private notifyPeers() {
    const list = this.getPeers();
    for (const listener of this.peerListeners) {
      listener(list);
    }
  }

  public async destroy() {
    this.signalingClient.destroy();
    for (const [, transport] of this.transports) {
      await transport.destroy();
    }
    this.peers.clear();
    this.messageListeners.clear();
    this.peerListeners.clear();
    this.diagListeners.clear();
  }
}
