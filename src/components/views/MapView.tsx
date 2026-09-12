// FIELDLINK Tactical GIS & Mesh Map View
import React, { useState, useEffect, useRef } from 'react';
import { offlineStorage, STORES } from '../../services/offlineStorageService';
import { p2pMesh } from '../../services/p2pMeshService';
import { Asset, Incident, PeerNode } from '../../types/tactical';
import { 
  MapPin, 
  AlertTriangle, 
  Radio, 
  Layers, 
  Compass, 
  ZoomIn, 
  ZoomOut, 
  Crosshair, 
  Shield, 
  Activity,
  X
} from 'lucide-react';
import { tacticalAudio } from '../../utils/audio';

export const MapView: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [peers, setPeers] = useState<PeerNode[]>([]);
  const [selectedItem, setSelectedItem] = useState<{ type: 'asset' | 'incident' | 'peer'; data: any } | null>(null);
  const [showAssets, setShowAssets] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [showMeshLinks, setShowMeshLinks] = useState(true);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    loadData();
    const unsubStorage = offlineStorage.subscribe(() => loadData());
    const unsubPeers = p2pMesh.subscribePeers((p) => setPeers(p));
    return () => {
      unsubStorage();
      unsubPeers();
    };
  }, []);

  const loadData = async () => {
    const a = await offlineStorage.getAll<Asset>(STORES.ASSETS);
    const inc = await offlineStorage.getAll<Incident>(STORES.INCIDENTS);
    setAssets(a || []);
    setIncidents(inc || []);
    setPeers(p2pMesh.getDiscoveredPeers());
  };

  // Tactical simulated GPS offsets
  const getSimulatedCoords = (id: string, index: number) => {
    const angle = (index * 60 * Math.PI) / 180;
    const distance = 0.08 + (index % 3) * 0.04;
    return {
      lat: Math.sin(angle) * distance,
      lng: Math.cos(angle) * distance,
    };
  };

  // Convert GPS lat/lng offset to canvas pixels
  const coordToCanvas = (latOffset: number, lngOffset: number, width: number, height: number) => {
    const scale = 1600 * zoom;
    const cx = width / 2 + pan.x;
    const cy = height / 2 + pan.y;
    const x = cx + lngOffset * scale;
    const y = cy - latOffset * scale;
    return { x, y };
  };

  // Render Tactical Map on HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    const height = (canvas.height = canvas.parentElement?.clientHeight || 550);

    // Background: Clean tactical slate-900 surface
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
    ctx.lineWidth = 1;
    const gridSize = 40 * zoom;
    const offsetX = (width / 2 + pan.x) % gridSize;
    const offsetY = (height / 2 + pan.y) % gridSize;

    for (let x = offsetX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Concentric Range Rings from Origin
    const center = { x: width / 2 + pan.x, y: height / 2 + pan.y };
    [80, 160, 240, 320].forEach((r) => {
      ctx.beginPath();
      ctx.arc(center.x, center.y, r * zoom, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.12)';
      ctx.stroke();
    });

    // Draw Mesh Links between discovered peers
    if (showMeshLinks && peers.length > 0) {
      ctx.lineWidth = 1.5;
      peers.forEach((peer, i) => {
        const p1Coord = getSimulatedCoords(peer.deviceId, i + 1);
        const p1 = coordToCanvas(p1Coord.lat, p1Coord.lng, width, height);

        // Link to base
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = peer.status === 'online' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.2)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // Base Station (Local Device)
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(center.x, center.y, 8 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('BASE (LOCAL)', center.x + 12, center.y + 4);

    // Draw Mesh Peer Nodes
    peers.forEach((peer, i) => {
      const coord = getSimulatedCoords(peer.deviceId, i + 1);
      const pt = coordToCanvas(coord.lat, coord.lng, width, height);

      ctx.fillStyle = peer.status === 'online' ? '#10b981' : '#64748b';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6 * zoom, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(peer.deviceName, pt.x + 10, pt.y + 3);
    });

    // Draw Assets
    if (showAssets) {
      assets.slice(0, 8).forEach((asset, i) => {
        const coord = getSimulatedCoords(asset.id, i + 3);
        const pt = coordToCanvas(coord.lat * 0.7, coord.lng * 0.7, width, height);

        ctx.fillStyle = asset.status === 'Available' ? '#10b981' : '#38bdf8';
        ctx.fillRect(pt.x - 4 * zoom, pt.y - 4 * zoom, 8 * zoom, 8 * zoom);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '9px monospace';
        ctx.fillText(asset.customId, pt.x + 8, pt.y + 3);
      });
    }

    // Draw Incidents
    if (showIncidents) {
      incidents.slice(0, 5).forEach((inc, i) => {
        const coord = getSimulatedCoords(inc.id, i + 5);
        const pt = coordToCanvas(coord.lat * 1.2, coord.lng * 1.2, width, height);

        ctx.fillStyle = inc.severity === 'Critical' ? '#ef4444' : '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - 7 * zoom);
        ctx.lineTo(pt.x + 6 * zoom, pt.y + 5 * zoom);
        ctx.lineTo(pt.x - 6 * zoom, pt.y + 5 * zoom);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(inc.incidentCode, pt.x + 8, pt.y + 3);
      });
    }
  }, [assets, incidents, peers, zoom, pan, showAssets, showIncidents, showMeshLinks]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono font-semibold text-blue-700 uppercase tracking-wider">
            Geospatial Intelligence · Multi-Hop Topology
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Tactical Map & GIS</h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
            Geospatial tracking of assets, muster callsigns, and mesh relay lines.
          </p>
        </div>

        {/* Layer Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAssets(!showAssets)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              showAssets
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            Assets ({assets.length})
          </button>
          <button
            onClick={() => setShowIncidents(!showIncidents)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              showIncidents
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            Incidents ({incidents.length})
          </button>
          <button
            onClick={() => setShowMeshLinks(!showMeshLinks)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              showMeshLinks
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            Mesh Links ({peers.length})
          </button>
        </div>
      </div>

      {/* Map Container Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs relative">
        {/* Canvas */}
        <div
          className="w-full h-[520px] cursor-grab active:cursor-grabbing relative overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <canvas ref={canvasRef} className="w-full h-full block" />

          {/* Floating Zoom Controls */}
          <div className="absolute right-4 bottom-4 flex flex-col space-y-1 bg-slate-900/80 backdrop-blur-xs p-1.5 rounded-xl border border-slate-700 shadow-lg">
            <button
              onClick={() => {
                tacticalAudio.playClick();
                setZoom((z) => Math.min(z + 0.25, 2.5));
              }}
              className="p-2 text-white hover:bg-slate-800 rounded-lg transition"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                tacticalAudio.playClick();
                setZoom((z) => Math.max(z - 0.25, 0.5));
              }}
              className="p-2 text-white hover:bg-slate-800 rounded-lg transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                tacticalAudio.playClick();
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-2 text-white hover:bg-slate-800 rounded-lg transition"
              title="Reset View"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </div>

          {/* Map Compass & Legend Indicator */}
          <div className="absolute left-4 top-4 bg-slate-900/80 backdrop-blur-xs px-3 py-2 rounded-xl border border-slate-700 text-xs font-mono text-slate-300 space-y-1">
            <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
              <Compass className="w-4 h-4 animate-spin-slow" />
              <span>SECTOR 4 GRID</span>
            </div>
            <div className="text-[10px] text-slate-400">Coord: 32.149° N, 76.321° E</div>
          </div>
        </div>
      </div>
    </div>
  );
};
