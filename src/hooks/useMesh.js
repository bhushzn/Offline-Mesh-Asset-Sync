/**
 * useMesh — React hook for mesh connection state
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { PeerManager } from '../mesh/peer-manager.js';

/**
 * Hook that provides mesh network state and controls.
 */
export function useMesh(localPeerId, callsign) {
  const [peers, setPeers] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  
  const [peerManager, setPeerManager] = useState(null);
  const peerManagerRef = useRef(null);

  // Initialize PeerManager
  useEffect(() => {
    if (!localPeerId || !callsign) return;

    const pm = new PeerManager(localPeerId, callsign);
    peerManagerRef.current = pm;
    setPeerManager(pm);

    const updatePeers = () => {
      setPeers(pm.getConnectedPeers());
    };

    pm.on('peer-connected', updatePeers);
    pm.on('peer-disconnected', updatePeers);
    pm.on('peer-error', ({ error: err }) => {
      setError(err?.message || 'Connection error');
    });

    return () => {
      pm.disconnectAll();
      peerManagerRef.current = null;
      setPeerManager(null);
    };
  }, [localPeerId, callsign]);

  /**
   * Create an offer (initiator side).
   */
  const createOffer = useCallback(async () => {
    const pm = peerManagerRef.current;
    if (!pm) return null;

    try {
      setIsConnecting(true);
      setError(null);
      const tempId = `pending-${Date.now()}`;
      const offerPayload = await pm.createOffer(tempId);
      return offerPayload;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  /**
   * Accept an offer (receiver side).
   */
  const acceptOffer = useCallback(async (offerPayload) => {
    const pm = peerManagerRef.current;
    if (!pm) return null;

    try {
      setIsConnecting(true);
      setError(null);
      const answerPayload = await pm.acceptOffer(offerPayload);
      return answerPayload;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  /**
   * Complete the handshake with the answer (initiator side).
   */
  const completeHandshake = useCallback(async (answerPayload) => {
    const pm = peerManagerRef.current;
    if (!pm) return;

    try {
      setIsConnecting(true);
      setError(null);
      await pm.completeHandshake(answerPayload);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  /**
   * Disconnect a specific peer.
   */
  const disconnectPeer = useCallback((peerId) => {
    const pm = peerManagerRef.current;
    if (pm) {
      pm.disconnect(peerId);
    }
  }, []);

  return {
    peerManager,
    peers,
    peerCount: peers.length,
    isConnecting,
    error,
    createOffer,
    acceptOffer,
    completeHandshake,
    disconnectPeer,
  };
}
