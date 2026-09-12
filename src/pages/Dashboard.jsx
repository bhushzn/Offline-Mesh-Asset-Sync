import React from 'react';
import { timeAgo, toDTG } from '../utils/time.js';

/**
 * Dashboard — Mesh Sync HQ Overview
 * 
 * Shows sync statistics, connected peer topology, and quick-action cards.
 */
export function Dashboard({ crdt, peerCount, peers, onNavigate }) {
  const stats = crdt.getStats();
  const equipmentCount = stats.collections.find(c => c.name === 'equipment')?.size || 0;
  const personnelCount = stats.collections.find(c => c.name === 'personnel')?.size || 0;
  const incidentCount = stats.collections.find(c => c.name === 'incidents')?.size || 0;

  // Compute muster stats
  const allPersonnel = crdt.getAll('personnel');
  const presentCount = allPersonnel.filter(([, p]) => p.status === 'present').length;

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          <span className="icon">◉</span> TacSync HQ
        </h1>
        <span className="text-mono text-xs text-dim">{toDTG(Date.now())}</span>
      </div>

      {/* Mesh Topology Visual */}
      <div className="mesh-visual">
        {/* Central node (self) */}
        <div className="mesh-node self" style={{
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)'
        }}>
          YOU
        </div>
        {/* Peer nodes in a circle */}
        {peers.map((peer, i) => {
          const angle = (2 * Math.PI * i) / Math.max(peers.length, 1) - Math.PI / 2;
          const radius = 70;
          const x = 50 + Math.cos(angle) * (radius / 2);
          const y = 50 + Math.sin(angle) * (radius / 2);
          return (
            <div
              key={peer.peerId}
              className="mesh-node peer"
              style={{
                left: `${x}%`, top: `${y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              title={peer.callsign}
            >
              {(peer.callsign || '').split('-')[0]?.slice(0, 3) || '?'}
            </div>
          );
        })}
      </div>

      {/* Stats Grid */}
      <div className="card-grid">
        <div className="card" onClick={() => onNavigate('equipment')} style={{ cursor: 'pointer' }}>
          <div className="card-header">
            <span className="card-title">Equipment</span>
            <span style={{ fontSize: '1.2rem' }}>⬡</span>
          </div>
          <div className="card-value">{equipmentCount}</div>
          <div className="card-subtitle">items tracked</div>
        </div>

        <div className="card" onClick={() => onNavigate('muster')} style={{ cursor: 'pointer' }}>
          <div className="card-header">
            <span className="card-title">Muster</span>
            <span style={{ fontSize: '1.2rem' }}>⦿</span>
          </div>
          <div className="card-value">
            {presentCount}<span className="text-dim text-sm">/{personnelCount}</span>
          </div>
          <div className="card-subtitle">present</div>
        </div>

        <div className="card" onClick={() => onNavigate('incidents')} style={{ cursor: 'pointer' }}>
          <div className="card-header">
            <span className="card-title">SITREP</span>
            <span style={{ fontSize: '1.2rem' }}>⚠</span>
          </div>
          <div className="card-value">{incidentCount}</div>
          <div className="card-subtitle">incidents logged</div>
        </div>

        <div className="card" onClick={() => onNavigate('mesh')} style={{ cursor: 'pointer' }}>
          <div className="card-header">
            <span className="card-title">Mesh</span>
            <span style={{ fontSize: '1.2rem' }}>◎</span>
          </div>
          <div className="card-value text-amber">{peerCount}</div>
          <div className="card-subtitle">
            {peerCount > 0 ? 'peers linked' : 'no peers'}
          </div>
        </div>
      </div>

      {/* Sync Activity */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Sync Activity</span>
        </div>
        <div className="flex gap-lg items-center">
          <div>
            <div className="text-mono font-bold" style={{ fontSize: '1.2rem' }}>
              {stats.totalSynced}
            </div>
            <div className="text-xs text-dim">ops synced</div>
          </div>
          <div style={{ flex: 1, height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (stats.totalSynced / Math.max(1, stats.totalSynced + 10)) * 100)}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent-green), var(--accent-amber))',
              borderRadius: '2px',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
        {peers.length > 0 && (
          <div className="mt-md" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {peers.slice(0, 3).map(peer => (
              <div key={peer.peerId} className="flex items-center justify-between text-xs">
                <span className="text-mono">{peer.callsign}</span>
                <span className="text-dim">{timeAgo(peer.connectedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
