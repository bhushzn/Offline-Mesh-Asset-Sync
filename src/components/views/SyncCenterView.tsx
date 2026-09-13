// ============================================================
// FIELDLINK — Hero Feature: Sync Center & Mesh Operations
// ============================================================

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
  Activity, 
  Layers,
  Cloud,
  Lock,
  Server,
  Zap,
  Check,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Battery
} from 'lucide-react';
import { PeerNode, SyncQueueItem, CRDTOperation, SyncStats, ConflictRecord } from '../../types/tactical';
import { p2pMesh } from '../../services/p2pMeshService';
import { syncQueue } from '../../services/syncQueueService';
import { syncManager } from '../../services/syncManager';
import { offlineStorage, STORES } from '../../services/offlineStorageService';
import { cloudSync, CloudSyncResult } from '../../services/cloudSyncService';
import { tacticalAudio } from '../../utils/audio';
import { auditLog } from '../../services/auditLogService';
import { deviceIdentity } from '../../services/deviceIdentityService';
import { isNativePlatform } from '../../services/nativeBlePlugin';

interface Props {
  syncStats: SyncStats;
}

export const SyncCenterView: React.FC<Props> = ({ syncStats }) => {
  const [peers, setPeers] = useState<PeerNode[]>([]);
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [crdtOps, setCrdtOps] = useState<CRDTOperation[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [activePipelineStep, setActivePipelineStep] = useState<number>(7);
  const [testMessageText, setTestMessageText] = useState('');
  const [testMessages, setTestMessages] = useState<Array<{
    id: string;
    senderName: string;
    senderDeviceId: string;
    text: string;
    timestamp: number;
    direction: 'SENT' | 'RECEIVED';
  }>>([]);
  const [latestReceivedMsg, setLatestReceivedMsg] = useState<string | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const isNative = isNativePlatform();
  const localId = deviceIdentity.getDeviceId();
  const localName = deviceIdentity.getDeviceName();
  const localRole = deviceIdentity.getRole();

  const [cloudStatus, setCloudStatus] = useState({
    isOnline: true,
    isSyncing: false,
    lastSyncedAt: null as number | null,
    serverVersion: 0,
    serverAvailable: false,
  });
  const [lastCloudResult, setLastCloudResult] = useState<CloudSyncResult | null>(null);

  const pipelineSteps = [
    { label: 'Discovery', desc: 'Beacon broadcast & response' },
    { label: 'Authentication', desc: 'Identity & cryptographic check' },
    { label: 'Connection', desc: 'WebRTC / BLE / LAN DataChannel' },
    { label: 'Vector Clocks', desc: 'State clock exchange' },
    { label: 'Delta Calc', desc: 'Missing operations filter' },
    { label: 'CRDT Merge', desc: 'HLC / LWW deterministic merge' },
    { label: 'ACK Verify', desc: 'Remote confirmation receipt' },
    { label: 'Convergence', desc: 'Identical synchronized state' },
  ];

  useEffect(() => {
    loadData();

    const unsubPeers = p2pMesh.subscribePeers((list) => setPeers(list));
    const unsubQueue = syncQueue.subscribe((_, queue) => setQueueItems(queue));
    const unsubCloud = cloudSync.subscribe((status) => setCloudStatus(status));
    const unsubConflicts = syncManager.subscribeConflicts(() => {
      setConflicts(syncManager.getRecentConflicts());
    });

    const unsubMsgs = p2pMesh.subscribeMessages((msg) => {
      if (msg.type === 'TEST_PING') {
        tacticalAudio.playSyncSuccess();
        const payload = msg.payload || {};
        const incoming = {
          id: msg.msgId || `msg-${Date.now()}`,
          senderName: payload.senderName || `Node-${msg.senderDeviceId.slice(0, 5)}`,
          senderDeviceId: msg.senderDeviceId,
          text: payload.text || 'PING',
          timestamp: msg.timestamp || Date.now(),
          direction: 'RECEIVED' as const,
        };
        setTestMessages((prev) => [incoming, ...prev.slice(0, 19)]);
        setLatestReceivedMsg(`Received from ${incoming.senderName}: "${incoming.text}"`);
      }
    });

    setConflicts(syncManager.getRecentConflicts());

    return () => {
      unsubPeers();
      unsubQueue();
      unsubCloud();
      unsubConflicts();
      unsubMsgs();
    };
  }, []);

  const handleSendTestMessage = async (customText?: string) => {
    tacticalAudio.playClick();
    setIsSendingTest(true);
    const text = (customText || testMessageText).trim() || `HELLO FROM ${localName} (${localId.slice(0, 8)})`;
    await p2pMesh.sendTestPing(text);
    const sent = {
      id: `sent-${Date.now()}`,
      senderName: localName,
      senderDeviceId: localId,
      text,
      timestamp: Date.now(),
      direction: 'SENT' as const,
    };
    setTestMessages((prev) => [sent, ...prev.slice(0, 19)]);
    setTestMessageText('');
    setIsSendingTest(false);
  };

  const loadData = async () => {
    const [q, ops] = await Promise.all([
      syncQueue.getAllQueueItems(),
      offlineStorage.getAll<CRDTOperation>(STORES.CRDT_OPS),
    ]);
    setQueueItems(q);
    setCrdtOps(ops.slice(-15).reverse());
  };

  const handleSyncPeer = async (peerId: string) => {
    tacticalAudio.playClick();
    animatePipeline();
    await syncManager.syncWithPeer(peerId);
    tacticalAudio.playSyncSuccess();
    loadData();
  };

  const handleSyncAllPeers = async () => {
    tacticalAudio.playClick();
    setIsSyncingAll(true);
    animatePipeline();
    await syncManager.syncAllPeers();
    setIsSyncingAll(false);
    tacticalAudio.playSyncSuccess();
    loadData();
  };

  const handleTriggerCloudSync = async () => {
    tacticalAudio.playClick();
    setIsCloudSyncing(true);
    animatePipeline();
    const result = await cloudSync.triggerSync();
    setLastCloudResult(result);
    setIsCloudSyncing(false);
    if (result.success) {
      tacticalAudio.playSyncSuccess();
    }
    loadData();
  };

  const animatePipeline = () => {
    setActivePipelineStep(0);
    const interval = setInterval(() => {
      setActivePipelineStep((prev) => {
        if (prev >= 7) {
          clearInterval(interval);
          return 7;
        }
        return prev + 1;
      });
    }, 250);
  };

  const getQueueBadge = (state: SyncQueueItem['state']) => {
    switch (state) {
      case 'SYNCED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">SYNCED</span>;
      case 'ACK_RECEIVED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">ACK RECVD</span>;
      case 'SENDING':
      case 'SENT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse">SENDING</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">RETRYING</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">PENDING</span>;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2 font-sans">
            <Share2 className="w-6 h-6 text-blue-600" />
            Tactical Sync Engine
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Zero-bandwidth peer-to-peer data sync using Hybrid Logical Clocks (HLC) & CRDT conflict-free convergence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAllPeers}
            disabled={isSyncingAll}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-sm flex items-center space-x-2 touch-target-min"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
            <span>Sync All Mesh Peers</span>
          </button>
        </div>
      </div>

      {/* 8-Stage Interactive Sync Pipeline Visualizer */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            Synchronization Protocol Pipeline
          </span>
          <span className="text-xs font-mono text-slate-500">
            Step {activePipelineStep + 1} of 8: <span className="font-semibold text-blue-600">{pipelineSteps[activePipelineStep].label}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-2">
          {pipelineSteps.map((step, idx) => {
            const isCompleted = idx < activePipelineStep;
            const isCurrent = idx === activePipelineStep;
            return (
              <div 
                key={step.label}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  isCurrent
                    ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs'
                    : isCompleted
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-center mb-1">
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <span className="text-[10px] font-mono font-bold">0{idx + 1}</span>
                  )}
                </div>
                <div className="text-[11px] font-bold leading-tight truncate">{step.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cloud Synchronization Bridge Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-slate-900">Cloud Sync Bridge (Railway Fastify + PostgreSQL)</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                cloudStatus.serverAvailable ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {cloudStatus.serverAvailable ? 'CONNECTED' : 'LOCAL OFFLINE'}
              </span>
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-md">
              Endpoint: <span className="text-slate-700 font-medium">{cloudSync.getBackendUrl()}/sync</span> • Ver: #{cloudStatus.serverVersion}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            onClick={handleTriggerCloudSync}
            disabled={isCloudSyncing}
            className="px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition flex items-center space-x-1.5 shadow-xs touch-target-min"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? 'animate-spin' : ''}`} />
            <span>Reconcile Cloud</span>
          </button>
        </div>
      </div>
      {/* Autonomous Direct Phone-to-Phone P2P Hardware Mesh Console */}
      <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-md space-y-4 font-mono">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-700 text-blue-400 flex items-center justify-center font-bold">
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm text-white">Direct Phone-to-Phone Hardware BLE Mesh</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isNative 
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' 
                    : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                }`}>
                  {isNative ? 'ANDROID NATIVE BLE ACTIVE' : 'P2P WEB / EMULATION'}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Local Node: <span className="text-blue-300 font-semibold">{localName}</span> • ID: <span className="text-slate-300">{localId.slice(0, 8)}...</span> • Zero Laptop / Zero Internet Required
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              GATT Server &amp; Scanner: <span className="text-emerald-400 font-bold">RUNNING</span>
            </span>
          </div>
        </div>

        {/* Live Received Message Flash Banner */}
        {latestReceivedMsg && (
          <div className="bg-emerald-950/80 border border-emerald-500/70 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-200 animate-pulse">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong className="text-emerald-300">LIVE P2P MESSAGE CONFIRMED:</strong> {latestReceivedMsg}
              </span>
            </div>
            <button
              onClick={() => setLatestReceivedMsg(null)}
              className="text-slate-400 hover:text-white text-[10px] ml-2"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* P2P Test Message Transmission Suite */}
        <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-blue-400" />
              Direct P2P Test Message Transmitter (Phase 4)
            </span>
            <span className="text-[10px] text-slate-400">
              Broadcasts to nearby phones over BLE
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={testMessageText}
              onChange={(e) => setTestMessageText(e.target.value)}
              placeholder={`HELLO FROM ${localName} (${localId.slice(0, 8)})`}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => handleSendTestMessage()}
              disabled={isSendingTest}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-sm touch-target-min shrink-0"
            >
              <Send className={`w-3.5 h-3.5 ${isSendingTest ? 'animate-ping' : ''}`} />
              <span>{isSendingTest ? 'TRANSMITTING...' : 'SEND TEST MESSAGE'}</span>
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[10px] text-slate-500 self-center mr-1">Quick Presets:</span>
            <button
              onClick={() => handleSendTestMessage(`HELLO FROM ${localName}`)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 border border-slate-700"
            >
              HELLO FROM {localName}
            </button>
            <button
              onClick={() => handleSendTestMessage(`STATUS CHECK: ${localName} OPERATIONAL`)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 border border-slate-700"
            >
              STATUS CHECK: OPERATIONAL
            </button>
            <button
              onClick={() => handleSendTestMessage(`SITREP: FIELD SECTOR PATROL ACTIVE`)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 border border-slate-700"
            >
              SITREP: PATROL ACTIVE
            </button>
          </div>
        </div>

        {/* Live P2P Message Feed */}
        {testMessages.length > 0 && (
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Live P2P Packet Log ({testMessages.length})</span>
              <button
                onClick={() => setTestMessages([])}
                className="text-[10px] text-slate-500 hover:text-slate-300 underline"
              >
                Clear Log
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {testMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 ${
                    msg.direction === 'RECEIVED'
                      ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
                      : 'bg-blue-950/40 border-blue-800/50 text-blue-200'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                      msg.direction === 'RECEIVED'
                        ? 'bg-emerald-800 text-emerald-100'
                        : 'bg-blue-800 text-blue-100'
                    }`}>
                      {msg.direction}
                    </span>
                    <span className="font-bold text-white">{msg.senderName}:</span>
                    <span className="text-slate-200">"{msg.text}"</span>
                  </div>
                  <div className="text-[10px] text-slate-400 self-end sm:self-auto font-mono">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Discovered Field Peers Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-2">
            <Radio className="w-4 h-4 text-blue-600" />
            Discovered Mesh Nodes ({peers.length})
          </h2>
          <span className="text-xs text-slate-500 font-mono">Auto-discovering via WebRTC & BroadcastChannel</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {peers.length === 0 ? (
            <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400 text-sm">
              No nearby mesh devices detected. Looking for beacon signals...
            </div>
          ) : (
            peers.map((peer) => (
              <div key={peer.deviceId} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 hover:border-blue-300 transition shadow-xs">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center font-bold text-xs text-blue-700 font-mono">
                      {peer.deviceId.slice(0, 3).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{peer.deviceName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{peer.role}</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {peer.status.toUpperCase()}
                    </span>
                    {peer.isSimulated && (
                      <span className="text-[9px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                        SIMULATED
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2 border-y border-slate-100 text-center font-mono text-[11px]">
                  <div>
                    <div className="text-slate-400 text-[10px]">Transport</div>
                    <div className="font-semibold text-slate-700 truncate">{peer.connectionType}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Signal</div>
                    <div className="font-semibold text-slate-700">{peer.rssi} dBm</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Battery</div>
                    <div className="font-semibold text-slate-700">{peer.batteryLevel || 85}%</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[10px] text-slate-400 font-mono">
                    Last sync: {new Date(peer.lastSyncAt).toLocaleTimeString()}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleSendTestMessage(`PING TO ${peer.deviceName} FROM ${localName}`)}
                      className="px-2.5 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs border border-emerald-200 transition flex items-center space-x-1"
                      title="Send Direct P2P Ping"
                    >
                      <Send className="w-3 h-3" />
                      <span>Ping</span>
                    </button>
                    <button
                      onClick={() => handleSyncPeer(peer.deviceId)}
                      className="px-3 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs border border-blue-200 transition flex items-center space-x-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Sync</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sync Queue & CRDT Operations Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Outbound Sync Queue */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-amber-600" />
              Outbound Sync Queue ({queueItems.length})
            </span>
            <span className="text-xs text-slate-400 font-mono">IndexedDB Store</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {queueItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                Sync queue is empty. All local operations converged across peers.
              </div>
            ) : (
              queueItems.map((item) => (
                <div key={item.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs font-mono">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{item.operation.operationType}</span>
                      <span className="text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">{item.operation.entityType}</span>
                    </div>
                    <div className="text-slate-500 text-[11px] truncate max-w-xs">{item.opId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getQueueBadge(item.state)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Resolved Conflict Log */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              CRDT Conflict Resolution Log ({conflicts.length})
            </span>
            <span className="text-xs text-slate-400 font-mono">Deterministic LWW</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {conflicts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                No concurrent conflicts detected. All state changes ordered deterministically.
              </div>
            ) : (
              conflicts.map((cnf) => (
                <div key={cnf.conflictId} className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 space-y-1 text-xs font-mono">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span>{cnf.entityType.toUpperCase()}: {cnf.entityId}</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">RESOLVED</span>
                  </div>
                  <div className="text-[11px] text-slate-700">
                    Node A (<span className="font-semibold">{cnf.nodeAId}</span>) vs Node B (<span className="font-semibold">{cnf.nodeBId}</span>)
                  </div>
                  <div className="text-[10px] text-emerald-700 font-semibold">
                    Winner: Node {cnf.winningNodeId} via {cnf.resolutionRule}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
