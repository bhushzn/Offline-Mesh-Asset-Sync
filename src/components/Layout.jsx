import React from 'react';
import { StatusBar } from './UI.jsx';

/**
 * Layout — App shell with bottom navigation
 */

const NAV_ITEMS = [
  { id: 'dashboard', icon: '◉', label: 'HQ' },
  { id: 'equipment', icon: '⬡', label: 'Gear' },
  { id: 'muster', icon: '⦿', label: 'Muster' },
  { id: 'incidents', icon: '⚠', label: 'SITREP' },
  { id: 'mesh', icon: '◎', label: 'Mesh' },
];

export function Layout({ currentPage, onNavigate, peerCount, children }) {
  return (
    <div className="app-shell">
      <div className="app-content fade-in">
        <StatusBar peerCount={peerCount} />
        {children}
      </div>

      <nav className="bottom-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.id === 'mesh' && peerCount > 0 && (
              <span className="nav-badge">{peerCount}</span>
            )}
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
