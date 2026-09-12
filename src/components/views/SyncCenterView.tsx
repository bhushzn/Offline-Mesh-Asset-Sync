// FIELDLINK Sync Center & P2P Mesh Operations View
import React, { useEffect, useState } from 'react';
import { 
  Share2, 
  RefreshCw, 
  Radio, 
  Wifi, 
  Bluetooth, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Send, 
  Copy, 
  QrCode, 
  Activity, 
  Layers 
} from 'lucide-react';
import { PeerNode, SyncQueueItem, CRDTOperation, SyncStats } from '../../types/tactical';
import { p2pMesh } from '../../services/p2pMeshService';
import { syncQueue } from '../../services/syncQueueService';
import { syncManager } from '../../services/syncManager';
import { offlineStorage, STORES } from '../../services/offlineStorageService';
import { MeshTopology3D } from '../mesh/MeshTopology3D';
import { tacticalAudio } from '../../utils/audio';

import { cloudSync, CloudSyncResult } from '../../services/cloudSyncService';
import { Cloud, Lock, Server } from 'lucide-react';

interface Props {
  syncStats: SyncStats;
}

export const SyncCenterView: React.FC<Props> = ({ syncStats }) => {
  const [peers, setPeers] = useState<PeerNode[]>([]);
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [crdtOps, setCrdtOps] = useState<CRDTOperation[]>([]);
  const [conflicts, setConflicts] = useState<Array<{ description: string; timestamp: number }>>([]);
  const [isSignalingModalOpen, setIsSignalingModalOpen] = useState(false);
  const [webrtcOfferText, setWebrtcOfferText] = useState('');
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState({
    isOnline: true,
    isSyncing: false,
    lastSyncedAt: null as number | null,
    serverVersion: 0,
    serverAvailable: false,
  });
  const [lastCloudResult, setLastCloudResult] = useState<CloudSyncResult | null>(null);

  useEffect(() => {
    loadData();

    const unsubPeers = p2pMesh.subscribePeers((list) => setPeers(list));
    const unsubQueue = syncQueue.subscribe((_, queue) => setQueueItems(queue));
    const unsubCloud = cloudSync.subscribe((status) => setCloudStatus(status));
    const unsubConflicts = syncManager.subscribeConflicts(() => {
      setConflicts(syncManager.getRecentConflicts());
    });

    setConflicts(syncManager.getRecentConflicts());

    return () => {
      unsubPeers();
      unsubQueue();
      unsubCloud();
      unsubConflicts();
    };
  }, []);

  const loadData = async () => {
    const [q, ops] = await Promise.all([
      offlineStorage.getAll<SyncQueueItem>(STORES.SYNC_QUEUE),
      offlineStorage.getAll<CRDTOperation>(STORES.CRDT_OPS),
    ]);
    setQueueItems(q);
    setCrdtOps(ops.slice(-15).reverse());
  };

  const handleSyncPeer = async (peerId: string) => {
    tacticalAudio.playClick();
    await syncManager.syncWithPeer(peerId);
    tacticalAudio.playSyncSuccess();
    loadData();
  };

  const handleSyncAllPeers = async () => {
    tacticalAudio.playClick();
    setIsSyncingAll(true);
    await syncManager.syncAllPeers();
    setIsSyncingAll(false);
    tacticalAudio.playSyncSuccess();
    loadData();
  };

  const handleCreateWebRTCOffer = async (peerId: string) => {
    tacticalAudio.playClick();
    const offer = await p2pMesh.createWebRTCOffer(peerId);
    setWebrtcOfferText(offer);
    setIsSignalingModalOpen(true);
  };

  const handleTriggerCloudSync = async () => {
    tacticalAudio.playClick();
    setIsCloudSyncing(true);
    const res = await cloudSync.syncWithCloud();
    setLastCloudResult(res);
    setIsCloudSyncing(false);
    if (res.success) {
      tacticalAudio.playSyncSuccess();
    } else {
      tacticalAudio.playAlert();
    }
    loadData();
  };

  const isBLEAvailable = p2pMesh.isBLEAvailable();
  const isEncrypted = p2pMesh.isEncryptionActive();

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Context */}
      <div>
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          Mesh Synchronization Engine / CRDT Protocol
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-sans">Sync Center</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Peer-to-peer zero-bandwidth mesh discovery, vector clock exchange and deterministic CRDT delta merge.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleSyncAllPeers}
              disabled={isSyncingAll}
              className="px-4 py-2 rounded-md bg-[#ff5533] hover:bg-[#e64422] text-white font-semibold text-xs sm:text-sm transition flex items-center space-x-2 shadow-tactical-glow disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
              <span>{isSyncingAll ? 'Syncing Mesh...' : 'Sync All Peers'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Command HQ Cloud Gateway Synchronization Card */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            cloudStatus.serverAvailable ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}>
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-100 font-sans">Command HQ Central Backend</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                cloudStatus.serverAvailable ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {cloudStatus.serverAvailable ? 'ONLINE (FASTIFY+PRISMA)' : 'OFFLINE (MESH LOCAL)'}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">
              Endpoint: <span className="text-slate-300">{cloudSync.getBackendUrl()}/sync</span> • Server Ver: #{cloudStatus.serverVersion}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {lastCloudResult && (
            <div className="text-right text-[11px] font-mono hidden sm:block">
              <div className="text-emerald-400">↑ {lastCloudResult.pushedCount} pushed • ↓ {lastCloudResult.pulledCount} pulled</div>
              <div className="text-slate-500">{new Date(lastCloudResult.timestamp).toLocaleTimeString()}</div>
            </div>
          )}
          <button
            onClick={handleTriggerCloudSync}
            disabled={isCloudSyncing}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition flex items-center gap-2 shadow-lg shadow-blue-900/40 disabled:opacity-50"
          >
            <Cloud className={`w-4 h-4 ${isCloudSyncing ? 'animate-bounce' : ''}`} />
            <span>{isCloudSyncing ? 'Syncing with HQ...' : 'Sync with Command HQ'}</span>
          </button>
        </div>
      </div>

      {/* 3D Interactive Mesh Network Canvas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-[#ff5533]" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Interactive 3D Mesh Topology & Real-Time Signal Links
            </h2>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
            Vector Clock Protocol: Active
          </span>
        </div>
        <MeshTopology3D height="360px" interactive={true} />
      </div>

      {/* Telemetry & Capability Status Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono text-xs">
        {/* P2P Transport Status */}
        <div className="p-3.5 rounded-lg bg-[#11161a] border border-[#232c35] flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-cyan-950/60 text-cyan-400 flex items-center justify-center">
            <Wifi className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-400">P2P Mesh Layer</div>
            <div className="font-bold text-slate-100">BroadcastChannel + WebRTC</div>
          </div>
        </div>

        {/* E2E Mesh Crypto */}
        <div className="p-3.5 rounded-lg bg-[#11161a] border border-[#232c35] flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-amber-950/60 text-amber-400 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-400">E2E Mesh Encryption</div>
            <div className="font-bold text-amber-400">{isEncrypted ? 'AES-GCM 256 Active' : 'Disabled'}</div>
          </div>
        </div>

        {/* BLE Capability Badge */}
        <div className="p-3.5 rounded-lg bg-[#11161a] border border-[#232c35] flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-blue-950/60 text-blue-400 flex items-center justify-center">
            <Bluetooth className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-400">Web Bluetooth (BLE)</div>
            <div className="font-bold text-slate-100">
              {isBLEAvailable ? 'Hardware Supported' : 'Simulated / Fallback Mode'}
            </div>
          </div>
        </div>

        {/* CRDT Engine Status */}
        <div className="p-3.5 rounded-lg bg-[#11161a] border border-[#232c35] flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-emerald-950/60 text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-400">CRDT Resolution</div>
            <div className="font-bold text-emerald-400">Deterministic LWW + Set</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Nearby Mesh Nodes & Local Sync Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nearby Mesh Nodes */}
        <div className="bg-[#11161a] border border-[#232c35] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#232c35] pb-3">
            <div className="flex items-center space-x-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider">
                Discovered Mesh Peers ({peers.length})
              </h3>
            </div>
            <button
              onClick={() => p2pMesh.broadcastDiscovery()}
              className="text-xs font-mono text-slate-400 hover:text-slate-200"
            >
              Ping radar ↻
            </button>
          </div>

          <div className="space-y-3">
            {peers.map((peer) => (
              <div
                key={peer.deviceId}
                className="p-3.5 rounded-lg bg-[#161c22] border border-[#232c35] flex items-center justify-between gap-3 hover:border-[#394754] transition"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${peer.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <div>
                    <div className="text-xs font-bold text-slate-100 font-mono flex items-center space-x-2">
                      <span>{peer.deviceName}</span>
                      <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-[#0d1114] border border-[#232c35] text-slate-400">
                        {peer.connectionType}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Role: {peer.role} · RSSI: {peer.rssi}dBm · Latency: {peer.latencyMs}ms
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleSyncPeer(peer.deviceId)}
                    className="px-2.5 py-1 rounded bg-cyan-950/60 border border-cyan-800 text-cyan-300 text-xs font-mono font-bold hover:bg-cyan-900/60 transition flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync</span>
                  </button>
                  <button
                    onClick={() => handleCreateWebRTCOffer(peer.deviceId)}
                    className="p-1 rounded bg-[#232c35] text-slate-400 hover:text-slate-200"
                    title="Generate WebRTC Pairing SDP"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Local Sync Queue & CRDT Operations Log */}
        <div className="bg-[#11161a] border border-[#232c35] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#232c35] pb-3">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#ff5533]" />
              <h3 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider">
                CRDT Sync Queue ({syncStats.pendingCount} Pending)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Total Log: {syncStats.totalOpsCount} ops
            </span>
          </div>

          <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
            {crdtOps.length === 0 ? (
              <div className="text-xs font-mono text-slate-500 py-6 text-center">
                All records synchronized with nearby mesh nodes.
              </div>
            ) : (
              crdtOps.map((op) => (
                <div
                  key={op.id}
                  className="p-2.5 rounded bg-[#161c22] border border-[#232c35] text-xs font-mono flex items-center justify-between gap-2"
                >
                  <div className="truncate">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-100 font-semibold uppercase text-[11px]">{op.operationType}</span>
                      <span className="text-[#ff5533]">{op.entityType}</span>
                      <span className="text-slate-400 text-[10px]">({op.entityId})</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Hash: {op.hash} · Lamport: {op.lamportClock} · Node: {op.originDeviceId}
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800 flex-shrink-0">
                    Recorded
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Conflict Resolution Log (if any occurred) */}
      {conflicts.length > 0 && (
        <div className="bg-[#11161a] border border-amber-900/50 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs font-bold uppercase">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>CRDT Deterministic Conflict Resolution Feed</span>
          </div>
          <div className="space-y-2">
            {conflicts.map((c, i) => (
              <div key={i} className="text-xs font-mono p-2.5 rounded bg-[#161c22] border border-[#232c35] text-slate-300">
                <span className="text-emerald-400 font-bold">[Auto-Resolved] </span>
                {c.description}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WebRTC Signaling / QR Pairing Modal */}
      {isSignalingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#11161a] border border-[#232c35] rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#232c35] pb-3">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center space-x-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>WebRTC P2P Direct DataChannel Signaling</span>
              </h3>
              <button onClick={() => setIsSignalingModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400 font-mono">
              Zero-server P2P signaling. Copy this SDP offer or scan QR code on a second field laptop/phone to establish a direct WebRTC DataChannel.
            </p>

            <textarea
              rows={5}
              readOnly
              value={webrtcOfferText || 'Generating WebRTC ICE Candidates and SDP offer...'}
              className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-[10px] font-mono text-cyan-300 select-all"
            />

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(webrtcOfferText);
                  tacticalAudio.playSyncSuccess();
                }}
                className="px-3 py-1.5 rounded bg-cyan-900/60 border border-cyan-700 text-cyan-300 text-xs font-mono font-bold flex items-center space-x-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy SDP Payload</span>
              </button>

              <button
                onClick={() => setIsSignalingModalOpen(false)}
                className="px-3 py-1.5 rounded bg-[#161c22] text-slate-300 text-xs font-mono"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
