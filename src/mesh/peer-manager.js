/**
 * Peer Manager — RTCPeerConnection Pool
 * 
 * Manages all WebRTC peer connections, DataChannels, heartbeats, and
 * connection lifecycle. Emits events for the sync engine to react to.
 */

import { createOfferPayload, createAnswerPayload, applyAnswer } from './signaling.js';

// RTC configuration — no STUN needed on same subnet, but we include
// public Google STUN as optional fallback for cross-network scenarios
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

const HEARTBEAT_INTERVAL = 5000;  // 5 seconds
const HEARTBEAT_TIMEOUT = 15000;  // 15 seconds without heartbeat = dead

export class PeerManager {
  constructor(localPeerId, callsign) {
    this.localPeerId = localPeerId;
    this.callsign = callsign;

    /** @type {Map<string, RTCPeerConnection>} */
    this.connections = new Map();

    /** @type {Map<string, RTCDataChannel>} */
    this.channels = new Map();

    /** @type {Map<string, { callsign: string, connectedAt: number, lastHeartbeat: number }>} */
    this.peerInfo = new Map();

    /** @type {Map<string, number>} heartbeat interval IDs */
    this.heartbeatIntervals = new Map();

    // Event listeners
    this._listeners = {
      'peer-connected': [],
      'peer-disconnected': [],
      'peer-data': [],
      'peer-error': [],
    };
  }

  /**
   * Subscribe to an event.
   */
  on(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event].push(callback);
    }
  }

  /**
   * Remove a listener.
   */
  off(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Emit an event to all listeners.
   */
  _emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error(`Event handler error [${event}]:`, e); }
      });
    }
  }

  /**
   * Create a new RTCPeerConnection with standard handlers.
   */
  _createConnection(remotePeerId) {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        this._handleDisconnect(remotePeerId);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this._handleDisconnect(remotePeerId);
      }
    };

    this.connections.set(remotePeerId, pc);
    return pc;
  }

  /**
   * Set up a DataChannel (either created locally or received remotely).
   */
  _setupChannel(channel, remotePeerId) {
    channel.onopen = () => {
      this.channels.set(remotePeerId, channel);

      // Send our identity
      this._sendRaw(remotePeerId, {
        type: 'IDENTITY',
        peerId: this.localPeerId,
        callsign: this.callsign,
      });

      // Start heartbeat
      this._startHeartbeat(remotePeerId);

      this.peerInfo.set(remotePeerId, {
        callsign: remotePeerId.slice(0, 8),
        connectedAt: Date.now(),
        lastHeartbeat: Date.now(),
      });

      this._emit('peer-connected', { peerId: remotePeerId });
    };

    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this._handleMessage(remotePeerId, message);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    channel.onclose = () => {
      this._handleDisconnect(remotePeerId);
    };

    channel.onerror = (error) => {
      this._emit('peer-error', { peerId: remotePeerId, error });
    };
  }

  /**
   * Handle incoming messages.
   */
  _handleMessage(peerId, message) {
    switch (message.type) {
      case 'HEARTBEAT':
        this._sendRaw(peerId, { type: 'HEARTBEAT_ACK' });
        break;
      case 'HEARTBEAT_ACK':
        if (this.peerInfo.has(peerId)) {
          this.peerInfo.get(peerId).lastHeartbeat = Date.now();
        }
        break;
      case 'IDENTITY':
        if (this.peerInfo.has(peerId)) {
          this.peerInfo.get(peerId).callsign = message.callsign;
        }
        break;
      default:
        // Forward to sync engine / application layer
        this._emit('peer-data', { peerId, message });
    }
  }

  /**
   * Start heartbeat for a peer.
   */
  _startHeartbeat(peerId) {
    this._stopHeartbeat(peerId);
    const interval = setInterval(() => {
      const info = this.peerInfo.get(peerId);
      if (info && Date.now() - info.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        this._handleDisconnect(peerId);
        return;
      }
      this._sendRaw(peerId, { type: 'HEARTBEAT' });
    }, HEARTBEAT_INTERVAL);
    this.heartbeatIntervals.set(peerId, interval);
  }

  /**
   * Stop heartbeat for a peer.
   */
  _stopHeartbeat(peerId) {
    const interval = this.heartbeatIntervals.get(peerId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(peerId);
    }
  }

  /**
   * Handle peer disconnection.
   */
  _handleDisconnect(peerId) {
    this._stopHeartbeat(peerId);
    const channel = this.channels.get(peerId);
    if (channel) {
      try { channel.close(); } catch {}
      this.channels.delete(peerId);
    }
    const pc = this.connections.get(peerId);
    if (pc) {
      try { pc.close(); } catch {}
      this.connections.delete(peerId);
    }
    if (this.peerInfo.has(peerId)) {
      this.peerInfo.delete(peerId);
      this._emit('peer-disconnected', { peerId });
    }
  }

  /**
   * Send a raw message object to a peer.
   */
  _sendRaw(peerId, message) {
    const channel = this.channels.get(peerId);
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify(message));
    }
  }

  /**
   * Send a message to a specific peer.
   */
  send(peerId, message) {
    this._sendRaw(peerId, message);
  }

  /**
   * Broadcast a message to all connected peers.
   */
  broadcast(message) {
    for (const peerId of this.channels.keys()) {
      this._sendRaw(peerId, message);
    }
  }

  /**
   * INITIATOR flow: Create an offer to connect to a new peer.
   * Returns the offer payload string (for QR code or copy-paste).
   */
  async createOffer(remotePeerId) {
    const pc = this._createConnection(remotePeerId);

    // Create DataChannel before offer
    const channel = pc.createDataChannel('tacsync', {
      ordered: true,
    });
    this._setupChannel(channel, remotePeerId);

    const offerPayload = await createOfferPayload(pc, this.localPeerId);
    return offerPayload;
  }

  /**
   * RECEIVER flow: Accept an offer and create an answer.
   * Returns the answer payload string.
   */
  async acceptOffer(offerPayload) {
    const offer = JSON.parse(offerPayload);
    const remotePeerId = offer.peerId;
    const pc = this._createConnection(remotePeerId);

    // Listen for incoming DataChannel
    pc.ondatachannel = (event) => {
      this._setupChannel(event.channel, remotePeerId);
    };

    const answerPayload = await createAnswerPayload(pc, this.localPeerId, offerPayload);
    return answerPayload;
  }

  /**
   * INITIATOR flow: Apply the received answer to complete handshake.
   */
  async completeHandshake(answerPayload) {
    const answer = JSON.parse(answerPayload);
    const pc = this.connections.get(answer.peerId);
    if (!pc) throw new Error('No connection found for peer: ' + answer.peerId);
    await applyAnswer(pc, answerPayload);
  }

  /**
   * Get list of connected peer IDs.
   */
  getConnectedPeers() {
    return Array.from(this.peerInfo.entries()).map(([peerId, info]) => ({
      peerId,
      ...info,
    }));
  }

  /**
   * Get count of connected peers.
   */
  get peerCount() {
    return this.peerInfo.size;
  }

  /**
   * Disconnect from a specific peer.
   */
  disconnect(peerId) {
    this._handleDisconnect(peerId);
  }

  /**
   * Disconnect from all peers and clean up.
   */
  disconnectAll() {
    for (const peerId of [...this.connections.keys()]) {
      this._handleDisconnect(peerId);
    }
  }
}
