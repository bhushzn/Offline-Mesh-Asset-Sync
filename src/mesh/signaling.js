/**
 * Signaling — Serverless SDP exchange via QR codes and manual copy-paste
 * 
 * WebRTC requires an initial SDP offer/answer exchange before a P2P connection
 * can be established. Since we have no backend, we implement:
 * 1. QR Code exchange — Two-scan handshake
 * 2. Manual copy-paste — Fallback
 * 3. Gossip relay — Connected peers forward signaling for new peers
 */

/**
 * Compress an SDP string by removing unnecessary whitespace and comments.
 */
function compressSDP(sdp) {
  return sdp
    .split('\n')
    .filter(line => line.trim().length > 0)
    .join('\n');
}

/**
 * Create an offer payload for the initiating peer.
 * Returns a compressed JSON string suitable for QR code encoding.
 */
export async function createOfferPayload(peerConnection, localPeerId) {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  // Wait for ICE gathering to complete
  await waitForICEGathering(peerConnection);

  const payload = {
    type: 'offer',
    peerId: localPeerId,
    sdp: compressSDP(peerConnection.localDescription.sdp),
  };

  return JSON.stringify(payload);
}

/**
 * Create an answer payload in response to a received offer.
 */
export async function createAnswerPayload(peerConnection, localPeerId, offerPayload) {
  const offer = JSON.parse(offerPayload);

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription({ type: 'offer', sdp: offer.sdp })
  );

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  // Wait for ICE gathering to complete
  await waitForICEGathering(peerConnection);

  const payload = {
    type: 'answer',
    peerId: localPeerId,
    targetPeerId: offer.peerId,
    sdp: compressSDP(peerConnection.localDescription.sdp),
  };

  return JSON.stringify(payload);
}

/**
 * Apply a received answer to complete the handshake.
 */
export async function applyAnswer(peerConnection, answerPayload) {
  const answer = JSON.parse(answerPayload);
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription({ type: 'answer', sdp: answer.sdp })
  );
  return answer.peerId;
}

/**
 * Wait for ICE candidate gathering to complete.
 * Times out after 3 seconds to avoid hanging on networks without STUN.
 */
function waitForICEGathering(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }

    const timeout = setTimeout(resolve, 3000);

    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}

/**
 * Create a signaling relay message to forward through existing peers.
 */
export function createRelayMessage(fromPeerId, toPeerId, signalingPayload) {
  return JSON.stringify({
    type: 'signal_relay',
    from: fromPeerId,
    to: toPeerId,
    payload: signalingPayload,
  });
}

/**
 * Parse a signaling payload from any source (QR, paste, or relay).
 */
export function parseSignalingPayload(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
