import React from 'react';

/**
 * StatusBar — Shows mesh connection status and sync info
 */
export function StatusBar({ peerCount, lastSync, isSyncing }) {
  const statusClass = peerCount > 0 ? (isSyncing ? 'syncing' : 'online') : 'offline';
  const statusText = peerCount > 0
    ? `${peerCount} peer${peerCount !== 1 ? 's' : ''} connected`
    : 'No mesh connections';

  return (
    <div className="status-bar">
      <div className={`status-dot ${statusClass}`} />
      <span style={{ flex: 1 }}>{statusText}</span>
      {lastSync && (
        <span className="text-dim text-xs text-mono">
          SYNC {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

/**
 * Modal — Full-screen modal with slide-up animation
 */
export function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Badge — Status indicator pill
 */
export function Badge({ variant = 'neutral', children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

/**
 * EmptyState — Placeholder for empty lists
 */
export function EmptyState({ icon, title, text, action }) {
  return (
    <div className="empty-state fade-in">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-text">{text}</div>
      {action && <div style={{ marginTop: '16px' }}>{action}</div>}
    </div>
  );
}

/**
 * Toast notification system
 */
let toastId = 0;
let toastListeners = [];

export function addToast(message, type = 'info', duration = 3000) {
  const toast = { id: ++toastId, message, type, duration };
  toastListeners.forEach(fn => fn(toast));
  return toast.id;
}

export function ToastContainer() {
  const [toasts, setToasts] = React.useState([]);

  React.useEffect(() => {
    const listener = (toast) => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, toast.duration);
    };
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter(l => l !== listener);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.type === 'success' && '✓ '}
          {toast.type === 'error' && '✕ '}
          {toast.type === 'warning' && '⚠ '}
          {toast.type === 'info' && 'ℹ '}
          {toast.message}
        </div>
      ))}
    </div>
  );
}

/**
 * QR Display — Renders data as a QR-like visual (simplified SVG pattern)
 * In production, you'd use a QR library. This generates a visual representation.
 */
export function QRDisplay({ data, size = 200 }) {
  // Generate a deterministic pattern from the data for visual representation
  const cells = React.useMemo(() => {
    const grid = [];
    const hash = simpleHash(data);
    const gridSize = 21;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        // Position patterns (finder patterns)
        if (isFinderPattern(x, y, gridSize)) {
          grid.push({ x, y, filled: true });
        } else {
          const idx = y * gridSize + x;
          const bit = (hash[idx % hash.length] >> (idx % 8)) & 1;
          grid.push({ x, y, filled: bit === 1 });
        }
      }
    }
    return { grid, gridSize };
  }, [data]);

  const cellSize = size / cells.gridSize;

  return (
    <div className="qr-code">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect width={size} height={size} fill="white" />
        {cells.grid.filter(c => c.filled).map((cell, i) => (
          <rect
            key={i}
            x={cell.x * cellSize}
            y={cell.y * cellSize}
            width={cellSize}
            height={cellSize}
            fill="#0d1117"
            rx={1}
          />
        ))}
      </svg>
    </div>
  );
}

function isFinderPattern(x, y, size) {
  // Top-left
  if (x < 7 && y < 7) {
    if (x === 0 || x === 6 || y === 0 || y === 6) return true;
    if (x >= 2 && x <= 4 && y >= 2 && y <= 4) return true;
    return false;
  }
  // Top-right
  if (x >= size - 7 && y < 7) {
    const lx = x - (size - 7);
    if (lx === 0 || lx === 6 || y === 0 || y === 6) return true;
    if (lx >= 2 && lx <= 4 && y >= 2 && y <= 4) return true;
    return false;
  }
  // Bottom-left
  if (x < 7 && y >= size - 7) {
    const ly = y - (size - 7);
    if (x === 0 || x === 6 || ly === 0 || ly === 6) return true;
    if (x >= 2 && x <= 4 && ly >= 2 && ly <= 4) return true;
    return false;
  }
  return false;
}

function simpleHash(str) {
  const result = new Uint8Array(64);
  for (let i = 0; i < str.length; i++) {
    result[i % 64] = (result[i % 64] + str.charCodeAt(i) * 31 + i * 7) & 0xFF;
  }
  // Mix
  for (let round = 0; round < 4; round++) {
    for (let i = 0; i < 64; i++) {
      result[i] = (result[i] ^ result[(i + 17) % 64] ^ (result[(i + 31) % 64] << 3)) & 0xFF;
    }
  }
  return result;
}
