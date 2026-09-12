import { IMeshTransport, TransportMessageListener, TransportStateListener } from './MeshTransport';
import { TransportCapabilities, TransportStatus, TransportType } from '../../types/tactical';

interface PeerConnectionWrapper {
  peerId: string;
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  status: TransportStatus;
  lastPing: number;
  lastPong: number;
}

export class WebRTCTransport implements IMeshTransport {
  readonly type: TransportType = 'WebRTC';
  private connections = new Map<string, PeerConnectionWrapper>();
  private messageListeners = new Set<TransportMessageListener>();
  private stateListeners = new Set<TransportStateListener>();
  private status: TransportStatus = 'available';
  private localDeviceId: string;
  private signalingChannel?: (targetPeerId: string, signal: any) => void;
  private heartbeatInterval: any = null;

  // Standard STUN servers for NAT traversal with offline LAN fallback
  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  constructor(localDeviceId: string, signalingSender?: (targetPeerId: string, signal: any) => void) {
    this.localDeviceId = localDeviceId;
    this.signalingChannel = signalingSender;
    this.startHeartbeat();
  }

  public setSignalingSender(sender: (targetPeerId: string, signal: any) => void) {
    this.signalingChannel = sender;
  }

  public getStatus(): TransportStatus {
    return this.status;
  }

  public getCapabilities(): TransportCapabilities {
    const isSupported = typeof window !== 'undefined' && 'RTCPeerConnection' in window;
    return {
      type: 'WebRTC',
      isAvailable: isSupported,
      isSupported,
      latencyMs: 15,
      bandwidthKbps: 5000,
      mtuBytes: 65535,
      notes: 'Encrypted browser-to-browser P2P DataChannels',
    };
  }

  public async discover(): Promise<string[]> {
    return Array.from(this.connections.keys());
  }

  public async connect(peerId: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('RTCPeerConnection' in window)) {
      return false;
    }

    try {
      this.closePeer(peerId);
      const pc = new RTCPeerConnection(this.rtcConfig);
      const dc = pc.createDataChannel('fieldlink-mesh-sync', {
        ordered: true,
      });

      const wrapper: PeerConnectionWrapper = {
        peerId,
        pc,
        dc,
        status: 'connecting',
        lastPing: Date.now(),
        lastPong: Date.now(),
      };

      this.connections.set(peerId, wrapper);
      this.setupDataChannel(peerId, dc);
      this.setupPeerConnection(peerId, pc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (this.signalingChannel) {
        this.signalingChannel(peerId, {
          type: 'OFFER',
          sdp: offer,
          senderDeviceId: this.localDeviceId,
        });
      }

      return true;
    } catch (err) {
      console.error(`[WebRTC] Failed to connect to ${peerId}:`, err);
      this.notifyState(peerId, 'disconnected');
      return false;
    }
  }

  public async handleSignal(peerId: string, signal: any): Promise<void> {
    if (!signal || !signal.type) return;

    try {
      if (signal.type === 'OFFER') {
        await this.handleOffer(peerId, signal.sdp);
      } else if (signal.type === 'ANSWER') {
        await this.handleAnswer(peerId, signal.sdp);
      } else if (signal.type === 'ICE') {
        await this.handleIceCandidate(peerId, signal.candidate);
      }
    } catch (err) {
      console.error(`[WebRTC] Signal handling error with ${peerId}:`, err);
    }
  }

  private async handleOffer(peerId: string, sdp: RTCSessionDescriptionInit) {
    this.closePeer(peerId);
    const pc = new RTCPeerConnection(this.rtcConfig);

    const wrapper: PeerConnectionWrapper = {
      peerId,
      pc,
      status: 'connecting',
      lastPing: Date.now(),
      lastPong: Date.now(),
    };
    this.connections.set(peerId, wrapper);

    pc.ondatachannel = (event) => {
      wrapper.dc = event.channel;
      this.setupDataChannel(peerId, event.channel);
    };

    this.setupPeerConnection(peerId, pc);

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (this.signalingChannel) {
      this.signalingChannel(peerId, {
        type: 'ANSWER',
        sdp: answer,
        senderDeviceId: this.localDeviceId,
      });
    }
  }

  private async handleAnswer(peerId: string, sdp: RTCSessionDescriptionInit) {
    const wrapper = this.connections.get(peerId);
    if (!wrapper) return;
    await wrapper.pc.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    const wrapper = this.connections.get(peerId);
    if (!wrapper || !candidate) return;
    await wrapper.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private setupPeerConnection(peerId: string, pc: RTCPeerConnection) {
    pc.onicecandidate = (event) => {
      if (event.candidate && this.signalingChannel) {
        this.signalingChannel(peerId, {
          type: 'ICE',
          candidate: event.candidate,
          senderDeviceId: this.localDeviceId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        const wrap = this.connections.get(peerId);
        if (wrap) wrap.status = 'connected';
        this.notifyState(peerId, 'connected');
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.notifyState(peerId, 'disconnected');
        this.connections.delete(peerId);
      }
    };
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    dc.onopen = () => {
      const wrap = this.connections.get(peerId);
      if (wrap) wrap.status = 'connected';
      this.status = 'connected';
      this.notifyState(peerId, 'connected');
    };

    dc.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.__ping) {
          dc.send(JSON.stringify({ __pong: true, timestamp: Date.now() }));
          return;
        }
        if (parsed.__pong) {
          const wrap = this.connections.get(peerId);
          if (wrap) wrap.lastPong = Date.now();
          return;
        }
        for (const listener of this.messageListeners) {
          listener(parsed, peerId, 'WebRTC');
        }
      } catch (err) {
        console.warn(`[WebRTC] Malformed packet from ${peerId}:`, err);
      }
    };

    dc.onclose = () => {
      this.notifyState(peerId, 'disconnected');
      this.connections.delete(peerId);
    };

    dc.onerror = (err) => {
      console.warn(`[WebRTC] DC error with ${peerId}:`, err);
      this.notifyState(peerId, 'disconnected');
    };
  }

  public async send(peerId: string, message: any): Promise<boolean> {
    const wrap = this.connections.get(peerId);
    if (!wrap || !wrap.dc || wrap.dc.readyState !== 'open') {
      return false;
    }
    try {
      wrap.dc.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  public async broadcast(message: any): Promise<number> {
    let sentCount = 0;
    const raw = JSON.stringify(message);
    for (const [, wrap] of this.connections) {
      if (wrap.dc && wrap.dc.readyState === 'open') {
        try {
          wrap.dc.send(raw);
          sentCount++;
        } catch {
          // ignore
        }
      }
    }
    return sentCount;
  }

  public async disconnect(peerId: string): Promise<void> {
    this.closePeer(peerId);
  }

  private closePeer(peerId: string) {
    const wrap = this.connections.get(peerId);
    if (wrap) {
      try { wrap.dc?.close(); } catch {}
      try { wrap.pc.close(); } catch {}
      this.connections.delete(peerId);
      this.notifyState(peerId, 'disconnected');
    }
  }

  private startHeartbeat() {
    if (typeof window === 'undefined') return;
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [peerId, wrap] of this.connections) {
        if (wrap.dc && wrap.dc.readyState === 'open') {
          wrap.dc.send(JSON.stringify({ __ping: true, timestamp: now }));
          if (now - wrap.lastPong > 30000) {
            console.warn(`[WebRTC] Heartbeat timeout on peer ${peerId}`);
            this.closePeer(peerId);
          }
        }
      }
    }, 10000);
  }

  public onMessage(listener: TransportMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onStateChange(listener: TransportStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private notifyState(peerId: string, status: TransportStatus) {
    for (const listener of this.stateListeners) {
      listener(peerId, status, 'WebRTC');
    }
  }

  public async destroy(): Promise<void> {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    for (const peerId of Array.from(this.connections.keys())) {
      this.closePeer(peerId);
    }
    this.messageListeners.clear();
    this.stateListeners.clear();
  }
}
