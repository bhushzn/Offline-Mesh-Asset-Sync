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
  Maximize2
} from 'lucide-react';

export const MapView: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [peers, setPeers] = useState<PeerNode[]>([]);
  const [selectedItem, setSelectedItem] = useState<{ type: 'asset' | 'incident' | 'peer'; data: any } | null>(null);
  const [mapMode, setMapMode] = useState<'tactical' | 'topo' | 'grid'>('tactical');
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

  // Base geographical reference (e.g. Sector 4 Tactical Grid)
  const baseLat = 32.149;
  const baseLng = 76.321;

  // Convert GPS lat/lng or simulated offsets to canvas pixels
  const coordToCanvas = (latOffset: number, lngOffset: number, width: number, height: number) => {
    const scale = 1400 * zoom;
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
    const height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    // Background based on mapMode
    ctx.fillStyle = mapMode === 'topo' ? '#0b1612' : mapMode === 'grid' ? '#080d1a' : '#0a0e17';
    ctx.fillRect(0, 0, width, height);

    // Draw Grid Lines
    ctx.strokeStyle = mapMode === 'topo' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    const gridSize = 40 * zoom;
    const startX = (pan.x % gridSize) - gridSize;
    const startY = (pan.y % gridSize) - gridSize;

    for (let x = startX; x < width + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = startY; y < height + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw Topographic Contours if in topo mode
    if (mapMode === 'topo') {
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.2)';
      ctx.lineWidth = 1.5;
      for (let r = 80 * zoom; r <= 400 * zoom; r += 60 * zoom) {
        ctx.beginPath();
        ctx.ellipse(width / 2 + pan.x, height / 2 + pan.y, r * 1.4, r, 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Draw Mesh Peer Connection Lines
    const localPos = coordToCanvas(0, 0, width, height);
    peers.forEach((peer, idx) => {
      const angle = (idx / Math.max(peers.length, 1)) * Math.PI * 2;
      const dist = 0.08 + (idx % 3) * 0.04;
      const peerPos = coordToCanvas(Math.sin(angle) * dist, Math.cos(angle) * dist, width, height);

      ctx.beginPath();
      ctx.strokeStyle = peer.status === 'online' ? 'rgba(59, 130, 246, 0.35)' : 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(localPos.x, localPos.y);
      ctx.lineTo(peerPos.x, peerPos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw Local Node Marker
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(localPos.x, localPos.y, 8 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pulse animation around local node
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.beginPath();
    ctx.arc(localPos.x, localPos.y, 16 * zoom, 0, Math.PI * 2);
    ctx.stroke();
  }, [mapMode, zoom, pan, assets, incidents, peers]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] bg-slate-950 text-slate-100 relative overflow-hidden select-none">
      {/* Top Map HUD Controls */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-2 rounded-lg pointer-events-auto shadow-lg shadow-black/40">
          <Compass className="w-5 h-5 text-emerald-400 animate-spin-slow" />
          <div>
            <div className="text-xs font-mono font-bold tracking-wider text-emerald-400">SECTOR 4 GRID (MGRS 43R EK)</div>
            <div className="text-[10px] text-slate-400 font-mono">
              GPS: {baseLat.toFixed(4)}°N, {baseLng.toFixed(4)}°E • ALT 2,420M
            </div>
          </div>
        </div>

        {/* Map Layers & Zoom */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-1 flex gap-1 shadow-lg">
            <button
              onClick={() => setMapMode('tactical')}
              className={`px-3 py-1 text-xs rounded font-medium transition ${
                mapMode === 'tactical' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tactical
            </button>
            <button
              onClick={() => setMapMode('topo')}
              className={`px-3 py-1 text-xs rounded font-medium transition ${
                mapMode === 'topo' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Topo
            </button>
            <button
              onClick={() => setMapMode('grid')}
              className={`px-3 py-1 text-xs rounded font-medium transition ${
                mapMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Grid
            </button>
          </div>

          <div className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-1 flex gap-1 shadow-lg">
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetView}
              className="p-1.5 hover:bg-slate-800 text-slate-300 rounded"
              title="Recenter"
            >
              <Crosshair className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Map Area */}
      <div
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* DOM-rendered tactical markers for clickability */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Active Incidents */}
          {incidents.map((inc, i) => {
            const angle = (i / Math.max(incidents.length, 1)) * Math.PI * 1.5 + 0.4;
            const dist = 0.09 + (i % 2) * 0.05;
            const scale = 1400 * zoom;
            const cx = (canvasRef.current?.width || 800) / 2 + pan.x;
            const cy = (canvasRef.current?.height || 600) / 2 + pan.y;
            const left = cx + Math.cos(angle) * dist * scale;
            const top = cy - Math.sin(angle) * dist * scale;

            return (
              <div
                key={inc.id}
                style={{ left: `${left}px`, top: `${top}px` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem({ type: 'incident', data: inc });
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-red-600/30 border-2 border-red-500 flex items-center justify-center text-red-300 animate-pulse group-hover:scale-125 transition">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 bg-slate-900/90 border border-red-500/40 rounded text-[10px] font-mono text-red-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
                    {(inc as any).title || inc.incidentCode} ({inc.severity})
                  </div>
                </div>
              </div>
            );
          })}

          {/* Active Assets */}
          {assets.map((asset, i) => {
            const angle = (i / Math.max(assets.length, 1)) * Math.PI * 2;
            const dist = 0.06 + (i % 3) * 0.03;
            const scale = 1400 * zoom;
            const cx = (canvasRef.current?.width || 800) / 2 + pan.x;
            const cy = (canvasRef.current?.height || 600) / 2 + pan.y;
            const left = cx + Math.sin(angle) * dist * scale;
            const top = cy - Math.cos(angle) * dist * scale;

            return (
              <div
                key={asset.id}
                style={{ left: `${left}px`, top: `${top}px` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItem({ type: 'asset', data: asset });
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group"
              >
                <div className="relative">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-white border transition group-hover:scale-125 ${
                      asset.status === 'Deployed' || (asset.status as string) === 'deployed'
                        ? 'bg-amber-600/40 border-amber-400 text-amber-200'
                        : 'bg-emerald-600/40 border-emerald-400 text-emerald-200'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 bg-slate-900/90 border border-slate-700 rounded text-[10px] font-mono text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition">
                    {asset.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Marker Detail Drawer */}
      {selectedItem && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-4 shadow-2xl shadow-black/80 animate-in fade-in slide-in-from-bottom duration-200">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              {selectedItem.type === 'incident' ? (
                <AlertTriangle className="w-5 h-5 text-red-400" />
              ) : (
                <Shield className="w-5 h-5 text-blue-400" />
              )}
              <h3 className="font-semibold text-sm text-slate-100">
                {selectedItem.data.title || selectedItem.data.name}
              </h3>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          <div className="text-xs text-slate-300 space-y-1.5 font-mono">
            {selectedItem.type === 'incident' && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Severity:</span>
                  <span className="text-red-400 font-bold">{selectedItem.data.severity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span>{selectedItem.data.status}</span>
                </div>
                <div className="text-slate-300 mt-2 font-sans bg-slate-950/60 p-2 rounded border border-slate-800/80">
                  {selectedItem.data.description}
                </div>
              </>
            )}

            {selectedItem.type === 'asset' && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Category:</span>
                  <span>{selectedItem.data.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Condition:</span>
                  <span className="text-emerald-400">{selectedItem.data.condition}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="capitalize">{selectedItem.data.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Serial:</span>
                  <span>{selectedItem.data.serialNumber || 'N/A'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom Status Bar */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-[11px] font-mono text-slate-400 z-20">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            OFFLINE GIS CACHE ACTIVE
          </span>
          <span>ASSETS: {assets.length}</span>
          <span>ACTIVE HAZARDS: {incidents.length}</span>
          <span>MESH PEERS: {peers.filter((p) => p.status === 'online').length}</span>
        </div>
        <div className="hidden sm:block">ZOOM: {(zoom * 100).toFixed(0)}%</div>
      </div>
    </div>
  );
};
