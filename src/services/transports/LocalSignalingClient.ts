// ============================================================
// FIELDLINK — Local LAN WebSocket Signaling Client
// ============================================================
// Connects to local mesh signaling server (e.g. ws://192.168.x.x:3001/ws/mesh)
// Does NOT require internet or cloud services.
// Only handles discovery and WebRTC SDP/ICE negotiation.

export interface SignalingPeerInfo {
  deviceId: string;
  deviceName: string;
  role: string;
}

export type SignalingMessageCallback = (signal: any, fromDeviceId: string) => void;
export type PeerEventCallback = (action: 'PEER_JOINED' | 'PEER_LEFT', peer: SignalingPeerInfo) => void;
export type SignalingStatusCallback = (status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED') => void;

export class LocalSignalingClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private localDeviceId: string;
  private localDeviceName: string;
  private localRole: string;
  private isDestroyed = false;
  private reconnectTimer: any = null;
  private status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' = 'DISCONNECTED';

  private signalCallbacks: Set<SignalingMessageCallback> = new Set();
  private peerCallbacks: Set<PeerEventCallback> = new Set();
  private statusCallbacks: Set<SignalingStatusCallback> = new Set();
  private knownPeers: Map<string, SignalingPeerInfo> = new Map();

  constructor(
    localDeviceId: string,
    localDeviceName: string,
    localRole: string,
    defaultServerUrl?: string
  ) {
    this.localDeviceId = localDeviceId;
    this.localDeviceName = localDeviceName;
    this.localRole = localRole;

    const savedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('fieldlink_signaling_url') : null;
    const defaultHost = typeof window !== 'undefined' ? (window.location.hostname || 'localhost') : 'localhost';
    this.serverUrl = savedUrl || defaultServerUrl || `ws://${defaultHost}:3001/ws/mesh`;

    this.connect();
  }

  public setServerUrl(newUrl: string) {
    if (newUrl === this.serverUrl) return;
    this.serverUrl = newUrl;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('fieldlink_signaling_url', newUrl);
    }
    this.reconnect();
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  public getStatus(): 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' {
    return this.status;
  }

  public getKnownPeers(): SignalingPeerInfo[] {
    return Array.from(this.knownPeers.values());
  }

  public onSignal(cb: SignalingMessageCallback): () => void {
    this.signalCallbacks.add(cb);
    return () => this.signalCallbacks.delete(cb);
  }

  public onPeerEvent(cb: PeerEventCallback): () => void {
    this.peerCallbacks.add(cb);
    return () => this.peerCallbacks.delete(cb);
  }

  public onStatusChange(cb: SignalingStatusCallback): () => void {
    this.statusCallbacks.add(cb);
    cb(this.status);
    return () => this.statusCallbacks.delete(cb);
  }

  private setStatus(newStatus: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED') {
    this.status = newStatus;
    for (const cb of this.statusCallbacks) {
      cb(newStatus);
    }
  }

  public connect() {
    if (this.isDestroyed || typeof window === 'undefined') return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('CONNECTING');

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        // Register local device immediately
        this.send({
          action: 'REGISTER_DEVICE',
          deviceId: this.localDeviceId,
          deviceName: this.localDeviceName,
          role: this.localRole,
          timestamp: Date.now()
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleIncomingMessage(msg);
        } catch {
          // ignore malformed
        }
      };

      this.ws.onclose = () => {
        this.setStatus('DISCONNECTED');
        this.knownPeers.clear();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.setStatus('DISCONNECTED');
        this.ws?.close();
      };
    } catch {
      this.setStatus('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  private handleIncomingMessage(msg: any) {
    if (!msg || !msg.action) return;

    switch (msg.action) {
      case 'REGISTERED': {
        const peers = msg.activePeers || [];
        for (const peer of peers) {
          if (peer.deviceId && peer.deviceId !== this.localDeviceId) {
            this.knownPeers.set(peer.deviceId, peer);
            for (const cb of this.peerCallbacks) {
              cb('PEER_JOINED', peer);
            }
          }
        }
        break;
      }

      case 'PEER_JOINED': {
        if (msg.deviceId && msg.deviceId !== this.localDeviceId) {
          const peerInfo: SignalingPeerInfo = {
            deviceId: msg.deviceId,
            deviceName: msg.deviceName || `Node-${msg.deviceId.slice(0, 5)}`,
            role: msg.role || 'Field Operator'
          };
          this.knownPeers.set(msg.deviceId, peerInfo);
          for (const cb of this.peerCallbacks) {
            cb('PEER_JOINED', peerInfo);
          }
        }
        break;
      }

      case 'PEER_LEFT': {
        if (msg.deviceId) {
          const peerInfo = this.knownPeers.get(msg.deviceId) || {
            deviceId: msg.deviceId,
            deviceName: `Node-${msg.deviceId.slice(0, 5)}`,
            role: 'Field Operator'
          };
          this.knownPeers.delete(msg.deviceId);
          for (const cb of this.peerCallbacks) {
            cb('PEER_LEFT', peerInfo);
          }
        }
        break;
      }

      case 'WEBRTC_SIGNAL': {
        const fromDeviceId = msg.fromDeviceId;
        const signal = msg.signal;
        if (fromDeviceId && signal && fromDeviceId !== this.localDeviceId) {
          for (const cb of this.signalCallbacks) {
            cb(signal, fromDeviceId);
          }
        }
        break;
      }
    }
  }

  public sendSignal(targetDeviceId: string, signal: any): boolean {
    return this.send({
      action: 'WEBRTC_SIGNAL',
      senderDeviceId: this.localDeviceId,
      targetDeviceId,
      signal,
      timestamp: Date.now()
    });
  }

  private send(obj: any): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      this.ws.send(JSON.stringify(obj));
      return true;
    } catch {
      return false;
    }
  }

  public reconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.connect();
  }

  private scheduleReconnect() {
    if (this.isDestroyed) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 4000);
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.signalCallbacks.clear();
    this.peerCallbacks.clear();
    this.statusCallbacks.clear();
    this.knownPeers.clear();
  }
}
