import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout.jsx';
import { ToastContainer } from './components/UI.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Equipment } from './pages/Equipment.jsx';
import { MusterRoll } from './pages/MusterRoll.jsx';
import { Incidents } from './pages/Incidents.jsx';
import { MeshConnect } from './pages/MeshConnect.jsx';
import { useMesh } from './hooks/useMesh.js';
import { useCRDT } from './hooks/useCRDT.js';
import { useConfig } from './hooks/useDatabase.js';
import { generateId, generateCallsign } from './utils/uuid.js';

/**
 * App — Root component
 * 
 * Manages global state: page routing, mesh initialization, CRDT engine.
 * Hash-based routing for no-server navigation.
 */
export default function App() {
  // Persistent device identity
  const [localPeerId, setLocalPeerId, peerIdLoaded] = useConfig('localPeerId', null);
  const [callsign, setCallsign, callsignLoaded] = useConfig('callsign', null);
  const [currentPage, setCurrentPage] = useState(() => {
    return window.location.hash.slice(1) || 'dashboard';
  });

  // Initialize device identity on first run
  useEffect(() => {
    if (peerIdLoaded && !localPeerId) {
      setLocalPeerId(generateId());
    }
    if (callsignLoaded && !callsign) {
      setCallsign(generateCallsign());
    }
  }, [peerIdLoaded, callsignLoaded, localPeerId, callsign, setLocalPeerId, setCallsign]);

  // Mesh networking
  const mesh = useMesh(localPeerId, callsign);

  // CRDT state management
  const crdt = useCRDT(mesh.peerManager);

  // Hash-based routing
  useEffect(() => {
    const handleHash = () => {
      const page = window.location.hash.slice(1) || 'dashboard';
      setCurrentPage(page);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const navigate = (page) => {
    window.location.hash = page;
    setCurrentPage(page);
  };

  // Loading state
  if (!peerIdLoaded || !callsignLoaded || !localPeerId || !callsign) {
    return (
      <div className="loading-screen">
        <div className="logo-text">TACSYNC</div>
        <div className="spinner" />
        <div className="text-sm text-dim">Initializing secure node...</div>
      </div>
    );
  }

  // Wait for CRDT engine
  if (!crdt.ready) {
    return (
      <div className="loading-screen">
        <div className="logo-text">TACSYNC</div>
        <div className="spinner" />
        <div className="text-sm text-dim">Loading CRDT stores...</div>
      </div>
    );
  }

  // Render current page
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard crdt={crdt} peerCount={mesh.peerCount} peers={mesh.peers} onNavigate={navigate} />;
      case 'equipment':
        return <Equipment crdt={crdt} />;
      case 'muster':
        return <MusterRoll crdt={crdt} />;
      case 'incidents':
        return <Incidents crdt={crdt} />;
      case 'mesh':
        return <MeshConnect mesh={mesh} localPeerId={localPeerId} callsign={callsign} />;
      default:
        return <Dashboard crdt={crdt} peerCount={mesh.peerCount} peers={mesh.peers} onNavigate={navigate} />;
    }
  };

  return (
    <>
      <ToastContainer />
      <Layout currentPage={currentPage} onNavigate={navigate} peerCount={mesh.peerCount}>
        {renderPage()}
      </Layout>
    </>
  );
}
