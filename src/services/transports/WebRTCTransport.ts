import { IMeshTransport, TransportMessageListener, TransportStateListener } from './MeshTransport';
import { OperatingMode, TransportCapabilities, TransportStatus, TransportType } from '../../types/tactical';

interface PeerConnectionWrapper {
  peerId: string;
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  status: TransportStatus;
  lastPing: number;
  lastPong: number;
  isInitiator: boolean;
}

export class WebRTCTransport implements IMeshTransport {
  readonly type: TransportType = 'WebRTC';
  private connections = new Map<string, PeerConnectionWrapper>();
  private messageListeners = new Set<TransportMessageListener>();
  private stateListeners = new Set<TransportStateListener>();
  private status: TransportStatus = 'available';
  private localDeviceId: string;
  private mode: OperatingMode = 'FIELD_MODE';
  private signalingSender?: (targetPeerId: string, signal: any) => void;
  private heartbeatInterval: any = null;

  constructor(
    localDeviceId: string, 
    signalingSender?: (targetPeerId: string, signal: any) => void,
    mode: OperatingMode = 'FIELD_MODE'
  ) {
    this.localDeviceId = localDeviceId;
    this.signalingSender = signalingSender;
    this.mode = mode;
    this.startHeartbeat();
  }

  public setMode(newMode: OperatingMode) {
    this.mode = newMode;
  }

  public setSignalingSender(sender: (targetPeerId: string, signal: any) => void) {
    this.signalingSender = sender;
  }

  private getRTCConfiguration(): RTCConfiguration {
    // In FIELD_MODE (offline), DO NOT require or ping public STUN servers!
    // Empty iceServers forces WebRTC to use local LAN host candidates immediately without timeout.
    if (this.mode === 'FIELD_MODE') {
      return { iceServers: [] };
    }
    return {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };
  }

  public getStatus(): TransportStatus {
    return this.connections.size > 0 ? 'connected' : this.status;
  }

  public getCapabilities(): TransportCapabilities {
    const isSupported = typeof window !== 'undefined' && 'RTCPeerConnection' in window;
    return {
      type: 'WebRTC',
      isAvailable: isSupported,
      isSupported,
      latencyMs: 12,
      bandwidthKbps: 15000,
      mtuBytes: 65535,
      notes: this.mode === 'FIELD_MODE' 
        ? 'Direct P2P DataChannels (Offline LAN Mode · 0ms STUN delay)' 
        : 'Direct P2P DataChannels (Online STUN Mode)',
    };
  }

  public async discover(): Promise<string[]> {
    return Array.from(this.connections.keys());
  }

  public getConnectedPeerIds(): string[] {
    const connected: string[] = [];
    for (const [peerId, wrap] of this.connections) {
      if (wrap.dc && wrap.dc.readyState === 'open') {
        connected.push(peerId);
      }
    }
    return connected;
  }

  public isPeerConnected(peerId: string): boolean {
    const wrap = this.connections.get(peerId);
    return !!(wrap && wrap.dc && wrap.dc.readyState === 'open');
  }

  public async connect(peerId: string): Promise<boolean> {
    if (typeof window === 'undefined' || !('RTCPeerConnection' in window)) {
      return false;
    }
    if (peerId === this.localDeviceId) return false;

    // Check if already open
    const existing = this.connections.get(peerId);
    if (existing && existing.dc && existing.dc.readyState === 'open') {
      return true;
    }

    try {
      this.closePeer(peerId);
      const config = this.getRTCConfiguration();
      const pc = new RTCPeerConnection(config);
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
        isInitiator: true,
      };

      this.connections.set(peerId, wrapper);
      this.setupDataChannel(peerId, dc);
      this.setupPeerConnection(peerId, pc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (this.signalingSender) {
        this.signalingSender(peerId, {
          type: 'OFFER',
          sdp: offer,
          senderDeviceId: this.localDeviceId,
        });
      }

      return true;
    } catch (err) {
      console.error(`[WebRTC] Connect failure to ${peerId}:`, err);
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
      console.warn(`[WebRTC] Signal handling error from ${peerId}:`, err);
    }
  }

  private async handleOffer(peerId: string, sdp: RTCSessionDescriptionInit) {
    this.closePeer(peerId);
    const config = this.getRTCConfiguration();
    const pc = new RTCPeerConnection(config);

    const wrapper: PeerConnectionWrapper = {
      peerId,
      pc,
      status: 'connecting',
      lastPing: Date.now(),
      lastPong: Date.now(),
      isInitiator: false,
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

    if (this.signalingSender) {
      this.signalingSender(peerId, {
        type: 'ANSWER',
        sdp: answer,
        senderDeviceId: this.localDeviceId,
      });
    }
  }

  private async handleAnswer(peerId: string, sdp: RTCSessionDescriptionInit) {
    const wrapper = this.connections.get(peerId);
    if (!wrapper || !wrapper.pc) return;
    if (wrapper.pc.signalingState === 'have-local-offer') {
      await wrapper.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  private async handleIceCandidate(peerId: string, candidate: RTCIceCandidateInit) {
    const wrapper = this.connections.get(peerId);
    if (!wrapper || !candidate || !wrapper.pc) return;
    try {
      await wrapper.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // ignore candidate error if connection already established
    }
  }

  private setupPeerConnection(peerId: string, pc: RTCPeerConnection) {
    pc.onicecandidate = (event) => {
      if (event.candidate && this.signalingSender) {
        this.signalingSender(peerId, {
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
        this.status = 'connected';
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
          try {
            dc.send(JSON.stringify({ __pong: true, timestamp: Date.now() }));
          } catch {}
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
      console.warn(`[WebRTC] DC error on ${peerId}:`, err);
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
          try {
            wrap.dc.send(JSON.stringify({ __ping: true, timestamp: now }));
          } catch {}
          if (now - wrap.lastPong > 35000) {
            console.warn(`[WebRTC] Heartbeat timeout on peer ${peerId}`);
            this.closePeer(peerId);
          }
        }
      }
    }, 12000);
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
