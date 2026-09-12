import { IMeshTransport } from './MeshTransport';
import { WebRTCTransport } from './WebRTCTransport';
import { BLETransport } from './BLETransport';
import { LocalNetworkTransport } from './LocalNetworkTransport';
import { CloudTransport } from './CloudTransport';
import { OperatingMode, PeerNode, TransportCapabilities, TransportStatus, TransportType } from '../../types/tactical';

export class TransportManager {
  private transports: Map<TransportType, IMeshTransport> = new Map();
  private peers: Map<string, PeerNode> = new Map();
  private mode: OperatingMode = 'FIELD_MODE';
  private localDeviceId: string;
  private messageListeners = new Set<(message: any, peerId: string, transport: TransportType) => void>();
  private peerListeners = new Set<(peers: PeerNode[]) => void>();

  constructor(localDeviceId: string, wsUrl: string) {
    this.localDeviceId = localDeviceId;

    // 1. Initialize Local Network Transport (BroadcastChannel)
    const localNet = new LocalNetworkTransport(localDeviceId);
    this.transports.set('LocalNetwork', localNet);

    // 2. Initialize Cloud Transport (WebSocket Gateway)
    const cloud = new CloudTransport(localDeviceId, wsUrl);
    this.transports.set('Cloud', cloud);

    // 3. Initialize BLE Transport
    const ble = new BLETransport();
    this.transports.set('BLE', ble);

    // 4. Initialize WebRTC Transport with signaling routed through LocalNet or Cloud
    const webrtc = new WebRTCTransport(localDeviceId, (targetPeerId, signal) => {
      this.sendSignalingPacket(targetPeerId, signal);
    });
    this.transports.set('WebRTC', webrtc);

    // Wire up listeners
    for (const [type, transport] of this.transports) {
      transport.onMessage((msg, peerId, transType) => {
        this.handleIncomingTransportMessage(msg, peerId, transType);
      });
      transport.onStateChange((peerId, status, transType) => {
        this.handleTransportStateChange(peerId, status, transType);
      });
    }
  }

  public setMode(newMode: OperatingMode) {
    this.mode = newMode;
    if (newMode === 'FIELD_MODE') {
      // Clean out simulated peers
      for (const [id, peer] of Array.from(this.peers.entries())) {
        if (peer.isSimulated) {
          this.peers.delete(id);
        }
      }
    }
    this.notifyPeers();
  }

  public getMode(): OperatingMode {
    return this.mode;
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

  public async broadcast(message: any): Promise<number> {
    let totalSent = 0;
    for (const [, transport] of this.transports) {
      const sent = await transport.broadcast(message);
      totalSent += sent;
    }
    return totalSent;
  }

  public async sendToPeer(peerId: string, message: any): Promise<boolean> {
    const peer = this.peers.get(peerId);
    if (!peer) return false;

    const transport = this.transports.get(peer.connectionType);
    if (transport) {
      return await transport.send(peerId, message);
    }
    // Fallback: broadcast with target
    return (await this.broadcast({ ...message, targetDeviceId: peerId })) > 0;
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

  private handleIncomingTransportMessage(msg: any, peerId: string, transportType: TransportType) {
    // Check if message is a WebRTC signaling message
    if (msg && msg.__webrtc_signal) {
      const webrtc = this.transports.get('WebRTC') as WebRTCTransport;
      if (webrtc) {
        webrtc.handleSignal(msg.senderDeviceId || peerId, msg.__webrtc_signal);
      }
      return;
    }

    // Register or update peer info
    if (msg && msg.senderDeviceId && msg.senderDeviceId !== this.localDeviceId) {
      const existing = this.peers.get(msg.senderDeviceId);
      this.peers.set(msg.senderDeviceId, {
        deviceId: msg.senderDeviceId,
        deviceName: msg.deviceName || existing?.deviceName || `Node-${msg.senderDeviceId.slice(0, 4)}`,
        role: msg.role || existing?.role || 'Field Operator',
        nodeType: msg.nodeType || existing?.nodeType || 'Relay Node',
        rssi: transportType === 'LocalNetwork' ? -35 : transportType === 'WebRTC' ? -48 : -72,
        status: 'online',
        lastSyncAt: Date.now(),
        latencyMs: transportType === 'LocalNetwork' ? 2 : 25,
        connectionType: transportType,
        isTrusted: true,
        isSimulated: false,
        batteryLevel: msg.batteryLevel || existing?.batteryLevel || 88,
      });
      this.notifyPeers();
    }

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
    }
  }

  private sendSignalingPacket(targetPeerId: string, signal: any) {
    const packet = {
      __webrtc_signal: signal,
      senderDeviceId: this.localDeviceId,
      targetDeviceId: targetPeerId,
      timestamp: Date.now(),
    };
    // Send over LocalNetwork and Cloud
    this.transports.get('LocalNetwork')?.send(targetPeerId, packet);
    this.transports.get('Cloud')?.send(targetPeerId, packet);
  }

  private notifyPeers() {
    const list = this.getPeers();
    for (const listener of this.peerListeners) {
      listener(list);
    }
  }

  public async destroy() {
    for (const [, transport] of this.transports) {
      await transport.destroy();
    }
    this.peers.clear();
    this.messageListeners.clear();
    this.peerListeners.clear();
  }
}
