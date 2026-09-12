// ============================================================
// FIELDLINK — Operational Dashboard (Light Professional Theme)
// ============================================================

import React, { useEffect, useState } from 'react';
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
  Layers,
  CheckSquare
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
import { tacticalAudio } from '../../utils/audio';

interface Props {
  onNavigate: (tab: any) => void;
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

  // Network Failure Simulator States (Demo Mode only)
  const [simInternet, setSimInternet] = useState(false);
  const [simPeerA, setSimPeerA] = useState(true);
  const [simPeerB, setSimPeerB] = useState(true);

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
  }, []);

  const loadData = async () => {
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
  };

  const criticalIncidents = incidents.filter((i) => i.severity === 'Critical' || i.severity === 'High').length;
  const activePersonnel = personnel.filter((p) => p.status === 'Active' || p.status === 'Deployed').length;
  const readyAssets = assets.filter((a) => a.condition === 'Good' || a.condition === 'Operational').length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Subheader context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-500">
          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
          <span className="font-semibold text-slate-800 uppercase tracking-wider">Operational Readiness Hub</span>
          <span>• Local Sector Grid Alpha</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200">
            {mode === 'FIELD_MODE' ? '● FIELD MODE (STRICT)' : '⚡ DEMO MODE SIMULATION'}
          </span>
        </div>
      </div>

      {/* Hero Banner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 space-y-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 font-sans leading-tight">
            Zero-Bandwidth Field Sync.<br />
            <span className="text-blue-600">Always Operational.</span>
          </h1>
          <p className="text-slate-600 text-sm md:text-base max-w-xl leading-relaxed">
            Autonomous emergency operations platform. Coordinate gear accountability, personnel muster rolls, and tactical incident reporting across decentralized P2P device meshes without relying on internet connectivity.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={() => {
                tacticalAudio.playClick();
                onOpenLogIncident();
              }}
              className="px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition flex items-center space-x-2 shadow-xs touch-target-min"
            >
              <Plus className="w-4 h-4" />
              <span>Report Incident</span>
            </button>

            <button
              onClick={() => {
                tacticalAudio.playClick();
                onNavigate('personnel');
              }}
              className="px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold text-sm transition flex items-center space-x-2 shadow-xs touch-target-min"
            >
              <Users className="w-4 h-4 text-blue-600" />
              <span>Muster Squad</span>
            </button>

            <button
              onClick={() => {
                tacticalAudio.playClick();
                onNavigate('sync');
              }}
              className="px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 font-semibold text-sm transition flex items-center space-x-2 shadow-xs touch-target-min"
            >
              <Share2 className="w-4 h-4 text-blue-600" />
              <span>Sync Center</span>
            </button>
          </div>
        </div>

        {/* Dynamic Readiness Score Hero Card */}
        <div className="lg:col-span-5">
          <div className="bg-white p-6 border border-slate-200 rounded-2xl bg-gradient-to-br from-white to-slate-50 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-slate-900 text-sm tracking-tight uppercase font-mono">Mission Readiness</span>
              </div>
              <span className="text-2xl font-black font-mono text-blue-600">
                {readiness ? `${readiness.overallScore}%` : '87%'}
              </span>
            </div>

            {/* Progress breakdown */}
            <div className="space-y-3 pt-2">
              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Assets & Gear (30%)</span>
                  <span className="font-mono text-slate-900">{readiness ? `${readiness.assetScore}%` : '92%'}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${readiness?.assetScore || 92}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Personnel Muster (30%)</span>
                  <span className="font-mono text-slate-900">{readiness ? `${readiness.personnelScore}%` : '90%'}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-600 h-2 rounded-full transition-all duration-500" style={{ width: `${readiness?.personnelScore || 90}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Checklists Completed (20%)</span>
                  <span className="font-mono text-slate-900">{readiness ? `${readiness.checklistScore}%` : '84%'}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${readiness?.checklistScore || 84}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                  <span>Incident Safety Index (20%)</span>
                  <span className="font-mono text-slate-900">{readiness ? `${readiness.incidentScore}%` : '72%'}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-amber-500 h-2 rounded-full transition-all duration-500" style={{ width: `${readiness?.incidentScore || 72}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Assets Card */}
        <div
          onClick={() => {
            tacticalAudio.playClick();
            onNavigate('assets');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-300 shadow-xs hover:shadow-md transition cursor-pointer space-y-3 group"
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
          <div className="text-[11px] text-emerald-700 font-mono font-medium flex items-center gap-1">
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
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-300 shadow-xs hover:shadow-md transition cursor-pointer space-y-3 group"
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
          <div className="text-[11px] text-emerald-700 font-mono font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{personnel.filter(p => p.lastRollCallStatus === 'Present').length} Present in muster</span>
          </div>
        </div>

        {/* Checklists Card */}
        <div
          onClick={() => {
            tacticalAudio.playClick();
            onNavigate('checklists');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-xs hover:shadow-md transition cursor-pointer space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
              <CheckSquare className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-900">
              {checklists.filter(c => c.status === 'Completed').length}/{checklists.length}
            </div>
            <div className="text-xs font-semibold text-slate-600">Tactical Checklists</div>
          </div>
          <div className="text-[11px] text-indigo-700 font-mono font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{checklists.filter(c => c.status === 'In Progress').length} in progress</span>
          </div>
        </div>

        {/* Incidents Card */}
        <div
          onClick={() => {
            tacticalAudio.playClick();
            onNavigate('incidents');
          }}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-rose-300 shadow-xs hover:shadow-md transition cursor-pointer space-y-3 group"
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
          <div className="text-[11px] text-rose-700 font-mono font-medium flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{incidents.filter(i => i.status === 'Open').length} Open SITREPs</span>
          </div>
        </div>
      </div>

      {/* Network Failure Simulator (Visible in DEMO MODE for presentation) */}
      {mode === 'DEMO_MODE' && (
        <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-amber-700" />
              <h3 className="font-bold text-slate-900 text-sm">Demo Network Failure Simulator</h3>
            </div>
            <span className="text-xs text-amber-800 font-mono bg-amber-100 px-2.5 py-0.5 rounded border border-amber-200">
              Interactive Test Bench
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Simulate dropping cellular and peer links. Watch operations queue in IndexedDB and automatically resolve when peers reconnect.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button
              onClick={() => setSimInternet(!simInternet)}
              className={`p-3 rounded-lg border text-xs font-mono font-semibold flex items-center justify-between transition ${
                simInternet ? 'bg-white border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {simInternet ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-rose-600" />}
                <span>Internet / Cloud</span>
              </div>
              <span>{simInternet ? 'ONLINE' : 'OFFLINE'}</span>
            </button>

            <button
              onClick={() => setSimPeerA(!simPeerA)}
              className={`p-3 rounded-lg border text-xs font-mono font-semibold flex items-center justify-between transition ${
                simPeerA ? 'bg-white border-blue-300 text-blue-800' : 'bg-slate-100 border-slate-300 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-600" />
                <span>Peer B-04 (Patrol)</span>
              </div>
              <span>{simPeerA ? 'CONNECTED' : 'DISCONNECTED'}</span>
            </button>

            <button
              onClick={() => setSimPeerB(!simPeerB)}
              className={`p-3 rounded-lg border text-xs font-mono font-semibold flex items-center justify-between transition ${
                simPeerB ? 'bg-white border-blue-300 text-blue-800' : 'bg-slate-100 border-slate-300 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600" />
                <span>Node M-08 (Medical)</span>
              </div>
              <span>{simPeerB ? 'CONNECTED' : 'DISCONNECTED'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3D Mesh Topology & Live Nearby Peers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">3D Tactical Mesh Topology</h3>
            </div>
            <span className="text-xs font-mono text-slate-500">Live Spatial Nodes</span>
          </div>

          <div className="h-64 sm:h-72 rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
            <MeshTopology3D />
          </div>
        </div>

        {/* Nearby Field Devices List */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Radio className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-sm">Nearby Field Nodes</h3>
            </div>
            <span className="text-xs font-mono text-slate-500">{peers.length} Nodes</span>
          </div>

          <div className="space-y-2.5">
            {peers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                No nearby mesh devices detected. Looking for beacons...
              </div>
            ) : (
              peers.map((peer) => (
                <div 
                  key={peer.deviceId}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 flex items-center justify-between transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-xs text-blue-700 font-mono shadow-xs">
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
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
