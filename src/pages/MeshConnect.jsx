import React, { useState } from 'react';
import { Badge, EmptyState, QRDisplay, addToast } from '../components/UI.jsx';
import { timeAgo } from '../utils/time.js';

/**
 * MeshConnect — Peer connection management via SDP exchange
 * 
 * Supports two connection flows:
 * 1. QR Code: Display/scan SDP offers and answers
 * 2. Manual: Copy/paste SDP strings
 */
export function MeshConnect({ mesh, localPeerId, callsign }) {
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [step, setStep] = useState(0);
  const [offerPayload, setOfferPayload] = useState('');
  const [answerPayload, setAnswerPayload] = useState('');
  const [remotePayload, setRemotePayload] = useState('');

  const { peers, peerCount, createOffer, acceptOffer, completeHandshake, disconnectPeer, isConnecting } = mesh;

  // === CREATE OFFER FLOW ===
  const startCreateOffer = async () => {
    setMode('create');
    setStep(1);
    const offer = await createOffer();
    if (offer) {
      setOfferPayload(offer);
      setStep(2);
    } else {
      addToast('Failed to create offer', 'error');
      setMode(null);
    }
  };

  const handlePasteAnswer = async () => {
    if (!remotePayload.trim()) return;
    try {
      await completeHandshake(remotePayload.trim());
      addToast('Peer connected!', 'success');
      resetFlow();
    } catch (e) {
      addToast('Failed to connect: ' + e.message, 'error');
    }
  };

  // === JOIN (ACCEPT OFFER) FLOW ===
  const startJoin = () => {
    setMode('join');
    setStep(1);
  };

  const handlePasteOffer = async () => {
    if (!remotePayload.trim()) return;
    try {
      const answer = await acceptOffer(remotePayload.trim());
      if (answer) {
        setAnswerPayload(answer);
        setStep(2);
        addToast('Answer generated — share with peer', 'info');
      } else {
        addToast('Failed to accept offer', 'error');
      }
    } catch (e) {
      addToast('Invalid offer: ' + e.message, 'error');
    }
  };

  const resetFlow = () => {
    setMode(null);
    setStep(0);
    setOfferPayload('');
    setAnswerPayload('');
    setRemotePayload('');
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">
          <span className="icon">◎</span> Mesh
          <span className="page-count">{peerCount}</span>
        </h1>
      </div>

      {/* Device Identity */}
      <div className="card mb-lg">
        <div className="card-header">
          <span className="card-title">This Device</span>
          <Badge variant="amber">LOCAL</Badge>
        </div>
        <div className="text-mono font-bold" style={{ fontSize: '1.1rem' }}>{callsign}</div>
        <div className="text-xs text-dim text-mono mt-sm" style={{ wordBreak: 'break-all' }}>
          ID: {localPeerId.slice(0, 16)}…
        </div>
      </div>

      {/* Connection Flow */}
      {mode === null && (
        <div className="flex flex-col gap-md mb-lg">
          <button className="btn btn-primary btn-lg btn-full" onClick={startCreateOffer} disabled={isConnecting}>
            {isConnecting ? (
              <><span className="spinner" style={{ width: 16, height: 16 }} /> Connecting...</>
            ) : (
              '📡 Create Connection Offer'
            )}
          </button>
          <button className="btn btn-secondary btn-lg btn-full" onClick={startJoin} disabled={isConnecting}>
            🔗 Join — Accept an Offer
          </button>
        </div>
      )}

      {/* CREATE OFFER: Step 2 — Show offer, wait for answer */}
      {mode === 'create' && step === 2 && (
        <div className="card mb-lg">
          <div className="card-header">
            <span className="card-title">Step 1: Share this offer</span>
            <button className="btn btn-ghost btn-sm" onClick={resetFlow}>✕ Cancel</button>
          </div>
          <p className="text-sm text-muted mb-md">
            Share the QR code or copy the text below to the receiving device.
          </p>
          <div className="qr-container">
            <QRDisplay data={offerPayload} size={180} />
          </div>
          <div className="form-group">
            <label className="form-label">Offer SDP (copy this)</label>
            <textarea
              className="sdp-area"
              readOnly
              value={offerPayload}
              onClick={e => {
                e.target.select();
                navigator.clipboard?.writeText(offerPayload);
                addToast('Copied to clipboard', 'info');
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Step 2: Paste their answer</label>
            <textarea
              className="sdp-area"
              placeholder="Paste the answer SDP from the other device here..."
              value={remotePayload}
              onChange={e => setRemotePayload(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-full" onClick={handlePasteAnswer} disabled={!remotePayload.trim()}>
            Complete Connection
          </button>
        </div>
      )}

      {/* JOIN: Step 1 — Paste offer */}
      {mode === 'join' && step === 1 && (
        <div className="card mb-lg">
          <div className="card-header">
            <span className="card-title">Paste the offer</span>
            <button className="btn btn-ghost btn-sm" onClick={resetFlow}>✕ Cancel</button>
          </div>
          <p className="text-sm text-muted mb-md">
            Paste the SDP offer from the initiating device.
          </p>
          <div className="form-group">
            <textarea
              className="sdp-area"
              placeholder="Paste the offer SDP here..."
              value={remotePayload}
              onChange={e => setRemotePayload(e.target.value)}
              style={{ minHeight: '120px' }}
            />
          </div>
          <button className="btn btn-primary btn-full" onClick={handlePasteOffer} disabled={!remotePayload.trim() || isConnecting}>
            {isConnecting ? 'Processing...' : 'Accept Offer'}
          </button>
        </div>
      )}

      {/* JOIN: Step 2 — Show answer */}
      {mode === 'join' && step === 2 && (
        <div className="card mb-lg">
          <div className="card-header">
            <span className="card-title">Share this answer</span>
            <button className="btn btn-ghost btn-sm" onClick={resetFlow}>✕ Done</button>
          </div>
          <p className="text-sm text-muted mb-md">
            Share the QR code or copy the answer text back to the initiating device.
          </p>
          <div className="qr-container">
            <QRDisplay data={answerPayload} size={180} />
          </div>
          <div className="form-group">
            <label className="form-label">Answer SDP (copy this)</label>
            <textarea
              className="sdp-area"
              readOnly
              value={answerPayload}
              onClick={e => {
                e.target.select();
                navigator.clipboard?.writeText(answerPayload);
                addToast('Copied to clipboard', 'info');
              }}
            />
          </div>
          <p className="text-xs text-dim text-center mt-md">
            Connection will activate once the initiator applies this answer.
          </p>
        </div>
      )}

      {/* Connected Peers */}
      <div className="card-header mt-lg">
        <span className="card-title">Connected Peers</span>
      </div>

      {peerCount === 0 ? (
        <EmptyState
          icon="◎"
          title="No peers connected"
          text="Create an offer or join an existing peer to start syncing data over the mesh."
        />
      ) : (
        <div className="list">
          {peers.map(peer => (
            <div key={peer.peerId} className="peer-card">
              <div className="peer-avatar">
                {(peer.callsign || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="peer-info">
                <div className="peer-callsign">{peer.callsign || 'Unknown'}</div>
                <div className="peer-status">
                  Connected {timeAgo(peer.connectedAt)} · Last ping {timeAgo(peer.lastHeartbeat)}
                </div>
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => {
                  disconnectPeer(peer.peerId);
                  addToast('Peer disconnected', 'warning');
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Help text */}
      <div className="card mt-lg" style={{ borderColor: 'var(--accent-amber-dim)' }}>
        <div className="card-title mb-sm" style={{ color: 'var(--accent-amber)' }}>How Mesh Sync Works</div>
        <div className="text-sm text-muted" style={{ lineHeight: '1.7' }}>
          <strong>1.</strong> Device A creates an offer and shows a QR / text.<br />
          <strong>2.</strong> Device B scans/pastes the offer and generates an answer.<br />
          <strong>3.</strong> Device A scans/pastes the answer — connection established.<br />
          <strong>4.</strong> All data syncs automatically via CRDTs. No server needed.<br />
          <strong>5.</strong> Connected peers relay signals for new peers (gossip mesh).
        </div>
      </div>
    </div>
  );
}
