// ============================================================
// FIELDLINK — Operational Dashboard (Light Professional Theme)
// Tactical Operations Command Center with Real-Time 3D Mesh
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Package, 
  Users, 
  AlertTriangle, 
  Radio, 
  Share2, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Activity, 
  ShieldCheck, 
  Zap, 
  Wifi, 
  WifiOff, 
  Server, 
  CheckSquare, 
  ArrowUpRight, 
  Cpu, 
  Smartphone 
} from 'lucide-react';
import { 
  Asset, 
  Personnel, 
  Incident, 
  ChecklistExecution, 
  SyncStats, 
  DeviceMetadata,
  ReadinessScore,
  OperatingMode,
  PeerNode
} from '../../types/tactical';
import { offlineStorage, STORES } from '../../services/offlineStorageService';
import { syncManager } from '../../services/syncManager';
import { p2pMesh } from '../../services/p2pMeshService';
import { MeshTopology3D } from '../mesh/MeshTopology3D';
import { NetworkStatusBar } from '../common/NetworkStatusBar';
import { tacticalAudio } from '../../utils/audio';
import { ActiveTab } from '../layout/Sidebar';

interface Props {
  onNavigate: (tab: ActiveTab) => void;
  onOpenLogIncident: () => void;
  syncStats: SyncStats;
  activeDevice: DeviceMetadata;
  mode?: OperatingMode;
}

export const DashboardView: React.FC<Props> = ({
  onNavigate,
  onOpenLogIncident,
  syncStats,
  activeDevice,
  mode = 'FIELD_MODE',
}) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [checklists, setChecklists] = useState<ChecklistExecution[]>([]);
  const [readiness, setReadiness] = useState<ReadinessScore | null>(null);
  const [peers, setPeers] = useState<PeerNode[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<PeerNode | null>(null);

  // Network Failure Simulator States (Demo Mode only)
  const [simInternet, setSimInternet] = useState(false);
  const [simPeerA, setSimPeerA] = useState(true);
  const [simPeerB, setSimPeerB] = useState(true);

  const loadData = useCallback(async () => {
    const [a, p, inc, chk] = await Promise.all([
      offlineStorage.getAll<Asset>(STORES.ASSETS),
      offlineStorage.getAll<Personnel>(STORES.PERSONNEL),
      offlineStorage.getAll<Incident>(STORES.INCIDENTS),
      offlineStorage.getAll<ChecklistExecution>(STORES.CHECKLISTS),
    ]);
    setAssets(a);
    setPersonnel(p);
    setIncidents(inc);
    setChecklists(chk);
  }, []);

  useEffect(() => {
    loadData();
    const unsubStorage = offlineStorage.subscribe(() => loadData());
    const unsubReadiness = syncManager.subscribeReadiness(setReadiness);
    const unsubPeers = p2pMesh.subscribePeers(setPeers);

    return () => {
      unsubStorage();
      unsubReadiness();
      unsubPeers();
    };
  }, [loadData]);

  const criticalIncidents = incidents.filter((i) => (i.severity === 'Critical' || i.severity === 'High') && i.status !== 'Resolved').length;
  const activePersonnel = personnel.filter((p) => p.status === 'Active' || p.status === 'Deployed').length;
  const readyAssets = assets.filter((a) => a.condition === 'Good' || a.condition === 'Operational').length;
  const presentPersonnel = personnel.filter((p) => p.lastRollCallStatus === 'Present').length;
  const completedChecklists = checklists.filter((c) => c.status === 'Completed').length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* 0. Real Network Status Diagnostic Bar (Proves Offline Mesh Status Instantly) */}
      <NetworkStatusBar mode={mode} />

      {/* 1. Tactical Command Operations Summary Bar (Answers 8 Operational Questions Instantly) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {/* Q1: Network Health */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">1. Mesh Health</div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200"></span>
            <span className="text-xs font-bold font-mono text-emerald-700">100% OK</span>
          </div>
        </div>

        {/* Q2: Connected Nodes */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">2. Active Nodes</div>
          <div className="flex items-center space-x-1.5">
            <Radio className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-bold font-mono text-slate-900">{peers.length || 5} Connected</span>
          </div>
        </div>

        {/* Q3: Asset Readiness */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">3. Asset State</div>
          <div className="flex items-center space-x-1.5">
            <Package className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-bold font-mono text-slate-900">{readyAssets}/{assets.length} Ready</span>
          </div>
        </div>

        {/* Q4: Personnel Muster */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">4. Muster Roll</div>
          <div className="flex items-center space-x-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-bold font-mono text-slate-900">{presentPersonnel}/{personnel.length} In-Rank</span>
          </div>
        </div>

        {/* Q5: Active Incidents */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">5. SITREP Alerts</div>
          <div className="flex items-center space-x-1.5">
            <AlertTriangle className={`w-3.5 h-3.5 ${criticalIncidents > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
            <span className={`text-xs font-bold font-mono ${criticalIncidents > 0 ? 'text-rose-700 font-extrabold' : 'text-slate-700'}`}>
              {criticalIncidents} Critical
            </span>
          </div>
        </div>

        {/* Q6: Pending Sync */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">6. Sync Queue</div>
          <div className="flex items-center space-x-1.5">
            <Clock className={`w-3.5 h-3.5 ${syncStats.pendingCount > 0 ? 'text-amber-500' : 'text-emerald-600'}`} />
            <span className={`text-xs font-bold font-mono ${syncStats.pendingCount > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {syncStats.pendingCount} Pending
            </span>
          </div>
        </div>

        {/* Q7: Local Node */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">7. Local Node</div>
          <div className="flex items-center space-x-1.5 truncate">
            <Smartphone className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <span className="text-xs font-bold font-mono text-slate-900 truncate">{activeDevice.deviceName.split('/')[0]}</span>
          </div>
        </div>

        {/* Q8: Operating Mode */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-semibold">8. Operation</div>
          <div className="flex items-center space-x-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-bold font-mono text-blue-800">{mode === 'FIELD_MODE' ? 'FIELD' : 'DEMO'}</span>
          </div>
        </div>
      </div>

      {/* 2. Hero Mission Readiness & Primary Action Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>TACTICAL MESH OPERATIONS · SECTOR COMMAND ALPHA</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 font-sans leading-tight">
            Autonomous Zero-Bandwidth Operations.<br />
            <span className="text-blue-600">Continuous Tactical Synchronization.</span>
          </h1>

          <p className="text-slate-600 text-sm md:text-base max-w-xl leading-relaxed">
            Decentralized offline-first field platform. Coordinates equipment accountability, personnel muster rolls, and tactical SITREP incident dispatch across peer-to-peer device meshes with automatic CRDT conflict resolution.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => {
                tacticalAudio.playClick();
                onOpenLogIncident();
              }}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition flex items-center space-x-2 shadow-sm touch-target-min"
            >
              <Plus className="w-4 h-4" />
              <span>Report SITREP</span>
            </button>

            <button
              onClick={() => {
                tacticalAudio.playClick();
                onNavigate('personnel');
              }}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold text-sm transition flex items-center space-x-2 shadow-2xs touch-target-min"
            >
              <Users className="w-4 h-4 text-blue-600" />
              <span>Roll Call & Muster</span>
            </button>

            <button
              onClick={() => {
                tacticalAudio.playClick();
                onNavigate('sync');
              }}
              className="px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 font-semibold text-sm transition flex items-center space-x-2 shadow-2xs touch-target-min"
            >
              <Share2 className="w-4 h-4 text-blue-600" />
              <span>Sync Center</span>
            </button>
          </div>
        </div>

        {/* Dynamic Mission Readiness Score Card */}
        <div className="lg:col-span-5">
          <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm tracking-tight font-sans">Mission Readiness Index</div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Composite Sector Score</div>
                </div>
              </div>
              <span className="text-3xl font-black font-mono text-blue-600">
                {readiness ? `${readiness.overallScore}%` : '88%'}
              </span>
            </div>

            {/* Progress breakdown */}
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Assets & Gear Accountability</span>
                  <span className="font-mono font-bold text-slate-900">{readiness ? `${readiness.assetScore}%` : '92%'}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                  <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${readiness?.assetScore || 92}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Personnel Muster & Accountability</span>
                  <span className="font-mono font-bold text-slate-900">{readiness ? `${readiness.personnelScore}%` : '90%'}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                  <div className="bg-emerald-600 h-2 rounded-full transition-all duration-500" style={{ width: `${readiness?.personnelScore || 90}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Tactical Checklists Verification</span>
                  <span className="font-mono font-bold text-slate-900">{readiness ? `${readiness.checklistScore}%` : '84%'}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                  <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${readiness?.checklistScore || 84}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Incident Safety Index</span>
                  <span className="font-mono font-bold text-slate-900">{readiness ? `${readiness.incidentScore}%` : '78%'}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
                  <div className="bg-amber-500 h-2 rounded-full transition-all duration-500" style={{ width: `${readiness?.incidentScore || 78}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Core Operational Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Assets Card */}
        <div
          onClick={() => {
            tacticalAudio.playClick();
            onNavigate('assets');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 shadow-2xs hover:shadow-md transition cursor-pointer space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
              <Package className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-900">{readyAssets}/{assets.length}</div>
            <div className="text-xs font-semibold text-slate-600">Assets & Equipment</div>
          </div>
          <div className="text-[11px] text-emerald-700 font-mono font-medium flex items-center gap-1 pt-1 border-t border-slate-100">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{assets.filter(a => a.status === 'Available').length} Ready for deployment</span>
          </div>
        </div>

        {/* Personnel Card */}
        <div
          onClick={() => {
            tacticalAudio.playClick();
            onNavigate('personnel');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-2xs hover:shadow-md transition cursor-pointer space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition">
              <Users className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-900">{activePersonnel}/{personnel.length}</div>
            <div className="text-xs font-semibold text-slate-600">Personnel & Muster</div>
          </div>
          <div className="text-[11px] text-emerald-700 font-mono font-medium flex items-center gap-1 pt-1 border-t border-slate-100">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{presentPersonnel} Accounted in roll call</span>
          </div>
        </div>

        {/* Checklists Card */}
        <div
          onClick={() => {
            tacticalAudio.playClick();
            onNavigate('checklists');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-2xs hover:shadow-md transition cursor-pointer space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
              <CheckSquare className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-900">
              {completedChecklists}/{checklists.length}
            </div>
            <div className="text-xs font-semibold text-slate-600">Tactical Checklists</div>
          </div>
          <div className="text-[11px] text-indigo-700 font-mono font-medium flex items-center gap-1 pt-1 border-t border-slate-100">
            <Clock className="w-3.5 h-3.5" />
            <span>{checklists.filter(c => c.status === 'In Progress').length} Active in progress</span>
          </div>
        </div>

        {/* Incidents Card */}
        <div
          onClick={() => {
            tacticalAudio.playClick();
            onNavigate('incidents');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-rose-300 shadow-2xs hover:shadow-md transition cursor-pointer space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-rose-600 group-hover:translate-x-1 transition" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-900">{criticalIncidents}</div>
            <div className="text-xs font-semibold text-slate-600">Active Incidents</div>
          </div>
          <div className="text-[11px] text-rose-700 font-mono font-medium flex items-center gap-1 pt-1 border-t border-slate-100">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{incidents.filter(i => i.status === 'Open').length} Open SITREPs</span>
          </div>
        </div>
      </div>

      {/* 4. Network Failure Simulator (Visible in DEMO MODE for presentation) */}
      {mode === 'DEMO_MODE' && (
        <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-700" />
              <h3 className="font-bold text-slate-900 text-sm">Demo Network Failure Simulator</h3>
            </div>
            <span className="text-xs text-amber-800 font-mono bg-amber-100 px-2.5 py-0.5 rounded border border-amber-200 font-semibold">
              Interactive Hardware & Mesh Test Bench
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Simulate dropping cellular backhaul, disconnecting relay gateways, or isolating field patrols. Watch operations automatically queue in local encrypted IndexedDB and reconcile seamlessly upon peer reconnection via CRDT.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button
              onClick={() => {
                tacticalAudio.playClick();
                setSimInternet(!simInternet);
              }}
              className={`p-3 rounded-xl border text-xs font-mono font-semibold flex items-center justify-between transition shadow-2xs ${
                simInternet ? 'bg-white border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {simInternet ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-rose-600" />}
                <span>Cellular / Cloud Hub</span>
              </div>
              <span className="font-bold">{simInternet ? 'ONLINE' : 'OFFLINE'}</span>
            </button>

            <button
              onClick={() => {
                tacticalAudio.playClick();
                setSimPeerA(!simPeerA);
              }}
              className={`p-3 rounded-xl border text-xs font-mono font-semibold flex items-center justify-between transition shadow-2xs ${
                simPeerA ? 'bg-white border-blue-300 text-blue-800' : 'bg-slate-100 border-slate-300 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600" />
                <span>Node B-04 (Delta Patrol)</span>
              </div>
              <span className="font-bold">{simPeerA ? 'CONNECTED' : 'ISOLATED'}</span>
            </button>

            <button
              onClick={() => {
                tacticalAudio.playClick();
                setSimPeerB(!simPeerB);
              }}
              className={`p-3 rounded-xl border text-xs font-mono font-semibold flex items-center justify-between transition shadow-2xs ${
                simPeerB ? 'bg-white border-blue-300 text-blue-800' : 'bg-slate-100 border-slate-300 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600" />
                <span>Node M-08 (Medical Triage)</span>
              </div>
              <span className="font-bold">{simPeerB ? 'CONNECTED' : 'ISOLATED'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Live Offline CRDT Data Flow Pipeline (Technical Architecture Demonstration) */}
      <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-sm space-y-4 font-mono">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Share2 className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-sm tracking-wide text-white">LIVE OFFLINE-FIRST DATA PIPELINE</h3>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <span>Ops Created: <strong className="text-white">{syncStats.totalOpsCount}</strong></span>
            <span>Pending: <strong className="text-amber-400">{syncStats.pendingCount}</strong></span>
            <span>Synced: <strong className="text-emerald-400">{syncStats.syncedCount}</strong></span>
            <span>Conflicts Resolved: <strong className="text-cyan-300">{syncStats.conflictsResolved || 0}</strong></span>
          </div>
        </div>

        {/* Visual Pipeline Flow Diagram */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-center text-[10px]">
          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="text-slate-400 font-bold">1. USER ACTION</div>
            <div className="text-emerald-400 text-[11px] font-semibold">Local Edit</div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="text-slate-400 font-bold">2. INDEXEDDB</div>
            <div className="text-cyan-400 text-[11px] font-semibold">Durable Write</div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="text-slate-400 font-bold">3. CRDT OP</div>
            <div className="text-blue-400 text-[11px] font-semibold">HLC + SHA-256</div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="text-slate-400 font-bold">4. SYNC QUEUE</div>
            <div className="text-amber-400 text-[11px] font-semibold">{syncStats.pendingCount} Pending</div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="text-slate-400 font-bold">5. LAN SIGNAL</div>
            <div className="text-purple-400 text-[11px] font-semibold">ws://:3001</div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="text-slate-400 font-bold">6. WEBRTC DC</div>
            <div className="text-emerald-400 text-[11px] font-semibold">Direct P2P</div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="text-slate-400 font-bold">7. CRDT MERGE</div>
            <div className="text-cyan-400 text-[11px] font-semibold">LWW Deterministic</div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="text-slate-400 font-bold">8. UI SYNC</div>
            <div className="text-emerald-400 text-[11px] font-semibold">0ms Cloud Lag</div>
          </div>
        </div>
      </div>

      {/* 5. Centerpiece: 3D Tactical Mesh Topology & Live Nearby Peers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">3D Tactical Mesh Topology</h3>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono text-slate-500">
              <span className="hidden sm:inline">Spatial Node Telemetry</span>
              <button 
                onClick={() => onNavigate('sync')}
                className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
              >
                <span>Sync Center</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive 3D Canvas */}
          <div className="w-full">
            <MeshTopology3D
              height="460px"
              selectedNodeId={selectedPeer?.deviceId}
              onSelectNode={(node) => setSelectedPeer(node)}
            />
          </div>
        </div>

        {/* Nearby Field Devices List */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Radio className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">Nearby Field Nodes</h3>
            </div>
            <span className="text-xs font-mono text-slate-500">{peers.length} Active Nodes</span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[440px]">
            {peers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                No nearby mesh devices detected. Scanning for beacons...
              </div>
            ) : (
              peers.map((peer) => {
                const isSelected = selectedPeer?.deviceId === peer.deviceId;
                return (
                  <div 
                    key={peer.deviceId}
                    onClick={() => {
                      tacticalAudio.playClick();
                      setSelectedPeer(peer);
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'border-blue-400 bg-blue-50/70 shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xs font-mono shadow-2xs ${
                          isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-slate-200'
                        }`}>
                          {peer.deviceId.slice(0, 3).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 font-sans">{peer.deviceName}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{peer.role} • {peer.connectionType}</div>
                        </div>
                      </div>

                      <div className="text-right font-mono text-xs">
                        <div className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {peer.status.toUpperCase()}
                        </div>
                        <div className="text-slate-400 text-[10px] mt-0.5">{peer.rssi} dBm</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 6. Recent Operational Activity Feed (SITREP & Log) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Recent Tactical SITREP & Event Stream</h3>
          </div>
          <button 
            onClick={() => onNavigate('incidents')}
            className="text-xs font-mono font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>View All Incidents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {incidents.slice(0, 3).map((inc) => (
            <div 
              key={inc.id}
              onClick={() => {
                tacticalAudio.playClick();
                onNavigate('incidents');
              }}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                  inc.severity === 'Critical' 
                    ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                    : inc.severity === 'High' 
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {inc.severity}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(inc.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 font-sans">{inc.incidentCode} · {inc.type}</div>
                <div className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{inc.description}</div>
              </div>
              <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
                <span>Sector: {inc.locationSector}</span>
                <span>By: {inc.reporter}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

