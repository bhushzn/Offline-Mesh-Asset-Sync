import React, { useState, useEffect } from 'react';
import { 
  Wifi, 
  WifiOff, 
  Radio, 
  Share2, 
  CloudOff, 
  Cloud, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Settings, 
  Copy, 
  Check, 
  Zap 
} from 'lucide-react';
import { p2pMesh } from '../../services/p2pMeshService';
import { syncQueue } from '../../services/syncQueueService';
import { syncManager } from '../../services/syncManager';
import { NetworkDiagnostics, OperatingMode } from '../../types/tactical';

interface NetworkStatusBarProps {
  mode: OperatingMode;
  onOpenDiagnostics?: () => void;
}

export const NetworkStatusBar: React.FC<NetworkStatusBarProps> = ({ mode, onOpenDiagnostics }) => {
  const [diag, setDiag] = useState<NetworkDiagnostics>(p2pMesh.getDiagnostics());
  const [pendingCount, setPendingCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [signalingInput, setSignalingInput] = useState(p2pMesh.getSignalingServerUrl());
  const [lastSyncStr, setLastSyncStr] = useState('Just now');

  useEffect(() => {
    const unsubDiag = p2pMesh.subscribeDiagnostics((d) => setDiag(d));
    const unsubQueue = syncQueue.subscribe((count) => setPendingCount(count));
    const unsubStats = syncManager.subscribeStats((stats) => {
      if (!stats.lastSyncTime) {
        setLastSyncStr('Never');
      } else {
        const diffSec = Math.floor((Date.now() - stats.lastSyncTime) / 1000);
        if (diffSec < 5) setLastSyncStr('Just now');
        else if (diffSec < 60) setLastSyncStr(`${diffSec}s ago`);
        else setLastSyncStr(`${Math.floor(diffSec / 60)}m ago`);
      }
    });

    const interval = setInterval(() => {
      setDiag(p2pMesh.getDiagnostics());
    }, 3000);

    return () => {
      unsubDiag();
      unsubQueue();
      unsubStats();
      clearInterval(interval);
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(diag.signalingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    p2pMesh.setSignalingServerUrl(signalingInput.trim());
    setIsEditingUrl(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-700/90 rounded-2xl p-3.5 sm:p-4 text-slate-100 shadow-md font-mono select-none">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-500/20"></div>
          <span className="font-bold text-xs uppercase tracking-wider text-emerald-400">
            FIELDLINK LIVE MESH STATUS
          </span>
          <span className="text-slate-500">|</span>
          <span className={`text-[11px] px-2 py-0.5 rounded font-bold uppercase border ${
            mode === 'FIELD_MODE' 
              ? 'bg-blue-950 text-blue-300 border-blue-800'
              : mode === 'ONLINE_MODE'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
              : 'bg-amber-950 text-amber-300 border-amber-800'
          }`}>
            {mode === 'FIELD_MODE' ? 'FIELD (AIR-GAPPED)' : mode === 'ONLINE_MODE' ? 'ONLINE SYNC' : 'DEMO SIMULATION'}
          </span>
        </div>

        {/* Signaling URL quick copy / edit */}
        <div className="flex items-center space-x-2 text-xs">
          {isEditingUrl ? (
            <form onSubmit={handleSaveUrl} className="flex items-center gap-1.5">
              <input 
                type="text"
                value={signalingInput}
                onChange={(e) => setSignalingInput(e.target.value)}
                placeholder="ws://192.168.x.x:3001/ws/mesh"
                className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-100 text-xs font-mono w-56 focus:outline-none focus:border-cyan-500"
              />
              <button type="submit" className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-bold">
                Save
              </button>
              <button type="button" onClick={() => setIsEditingUrl(false)} className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-xs">
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center space-x-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px]">
              <span className="text-slate-400">Mesh Server:</span>
              <span className="text-cyan-300 font-bold truncate max-w-[200px]">{diag.signalingUrl}</span>
              <button 
                onClick={handleCopy} 
                className="p-1 hover:text-white text-slate-400 transition"
                title="Copy Server Address"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button 
                onClick={() => { setIsEditingUrl(true); setSignalingInput(diag.signalingUrl); }} 
                className="p-1 hover:text-white text-slate-400 transition"
                title="Change Local Server URL"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 7-Segment Tactical Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-3 text-xs">
        {/* 1. Internet Status */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 uppercase font-medium">Internet</div>
          <div className="flex items-center space-x-1.5 mt-1">
            {diag.internet === 'ONLINE' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-emerald-400">ONLINE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold text-amber-400">OFFLINE</span>
              </>
            )}
          </div>
        </div>

        {/* 2. Local Wi-Fi / LAN Signaling */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 uppercase font-medium">Local LAN Server</div>
          <div className="flex items-center space-x-1.5 mt-1">
            {diag.localSignaling === 'CONNECTED' ? (
              <>
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-emerald-400">CONNECTED</span>
              </>
            ) : diag.localSignaling === 'CONNECTING' ? (
              <>
                <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="font-bold text-amber-400">CONNECTING</span>
              </>
            ) : (
              <>
                <Radio className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-bold text-rose-400">DISCONNECTED</span>
              </>
            )}
          </div>
        </div>

        {/* 3. Mesh Network State */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 uppercase font-medium">P2P Mesh</div>
          <div className="flex items-center space-x-1.5 mt-1">
            {diag.mesh === 'ACTIVE' ? (
              <>
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-cyan-400">ACTIVE</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-bold text-slate-400">STANDBY</span>
              </>
            )}
          </div>
        </div>

        {/* 4. WebRTC Direct DataChannel */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 uppercase font-medium">WebRTC Transport</div>
          <div className="flex items-center space-x-1.5 mt-1">
            <Share2 className={`w-3.5 h-3.5 ${
              diag.webrtc === 'CONNECTED' ? 'text-emerald-400' :
              diag.webrtc === 'CONNECTING' ? 'text-amber-400 animate-pulse' : 'text-slate-500'
            }`} />
            <span className={`font-bold ${
              diag.webrtc === 'CONNECTED' ? 'text-emerald-400' :
              diag.webrtc === 'CONNECTING' ? 'text-amber-400' : 'text-slate-400'
            }`}>
              {diag.webrtc === 'NO_PEERS' ? 'WAITING PEERS' : diag.webrtc}
            </span>
          </div>
        </div>

        {/* 5. Connected Active Peers */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 uppercase font-medium">Connected Peers</div>
          <div className="flex items-center space-x-1.5 mt-1">
            <span className="text-sm font-bold text-white font-mono">{diag.activePeersCount}</span>
            <span className="text-[10px] text-slate-400">Peers Direct</span>
          </div>
        </div>

        {/* 6. Pending Operations */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 uppercase font-medium">Sync Queue</div>
          <div className="flex items-center space-x-1.5 mt-1">
            <span className={`text-sm font-bold font-mono ${pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {pendingCount}
            </span>
            <span className="text-[10px] text-slate-400">{pendingCount === 0 ? 'Synced' : 'Pending'}</span>
          </div>
        </div>

        {/* 7. Cloud Relay State */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 uppercase font-medium">Cloud Gateway</div>
          <div className="flex items-center space-x-1.5 mt-1">
            {diag.cloud === 'DISABLED' ? (
              <>
                <CloudOff className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-bold text-slate-400 text-[11px]">DISABLED</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-bold text-blue-400 text-[11px]">{diag.cloud}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Subtitle / Clarification */}
      <div className="pt-2.5 mt-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <div className="flex items-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {diag.internet === 'OFFLINE' && (diag.mesh === 'ACTIVE' || diag.localSignaling === 'CONNECTED') ? (
              <strong className="text-emerald-300">INTERNET IS OFF, BUT LOCAL MESH IS ACTIVE & SYNCHRONIZING LOCALLY.</strong>
            ) : diag.activePeersCount > 0 ? (
              <strong className="text-emerald-300">Synchronizing operational data directly across local WebRTC mesh.</strong>
            ) : (
              <span>Local changes are saved durably in IndexedDB. Start <code className="text-cyan-300">npm run mesh-server</code> to pair nearby devices.</span>
            )}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[10px] text-slate-400">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>Last Sync: <strong className="text-slate-200">{lastSyncStr}</strong></span>
        </div>
      </div>
    </div>
  );
};
