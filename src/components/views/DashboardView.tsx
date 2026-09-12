// FIELDLINK Tactical Dashboard View
import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  Package, 
  Users, 
  AlertTriangle, 
  Radio, 
  Share2, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Activity 
} from 'lucide-react';
import { 
  Asset, 
  Personnel, 
  Incident, 
  ChecklistExecution, 
  SyncStats, 
  DeviceMetadata 
} from '../../types/tactical';
import { offlineStorage, STORES } from '../../services/offlineStorageService';
import { MeshTopology3D } from '../mesh/MeshTopology3D';
import { tacticalAudio } from '../../utils/audio';

interface Props {
  onNavigate: (tab: any) => void;
  onOpenLogIncident: () => void;
  syncStats: SyncStats;
  activeDevice: DeviceMetadata;
}

export const DashboardView: React.FC<Props> = ({
  onNavigate,
  onOpenLogIncident,
  syncStats,
  activeDevice,
}) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [checklists, setChecklists] = useState<ChecklistExecution[]>([]);

  useEffect(() => {
    loadData();
    const unsub = offlineStorage.subscribe(() => {
      loadData();
    });
    return () => unsub();
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

  const criticalIncidents = incidents.filter((i) => i.severity === 'Critical').length;
  const monitoringIncidents = incidents.filter((i) => i.status === 'Monitoring').length;
  const activeAssetsCount = assets.length;
  const attentionAssetsCount = assets.filter((a) => a.condition === 'Degraded' || a.condition === 'Critical').length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Subheader context */}
      <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest flex items-center space-x-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff5533]"></span>
        <span>Operations Overview // 08:42 Local</span>
      </div>

      {/* Hero Banner Section matching screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 space-y-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-100 font-sans leading-tight">
            Stay ready.<br />
            <span className="text-[#ff5533]">Stay connected.</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-lg">
            Your field picture, even when the network disappears. Manage equipment, verify squad roll call, execute procedures, and mesh-sync peer-to-peer.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => {
                tacticalAudio.playClick();
                onOpenLogIncident();
              }}
              className="px-4 py-2.5 rounded-md bg-[#ff5533] hover:bg-[#e64422] text-white font-semibold text-sm transition flex items-center space-x-2 shadow-tactical-glow"
            >
              <Plus className="w-4 h-4" />
              <span>Log incident</span>
            </button>
            <button
              onClick={() => {
                tacticalAudio.playClick();
                onNavigate('sync');
              }}
              className="px-4 py-2.5 rounded-md bg-[#161c22] border border-[#232c35] hover:bg-[#1f2730] text-slate-200 font-semibold text-sm transition flex items-center space-x-2"
            >
              <Share2 className="w-4 h-4 text-cyan-400" />
              <span>Open sync center</span>
            </button>
          </div>
        </div>

        {/* Readiness Radial Score Card */}
        <div className="lg:col-span-5 flex items-center justify-start lg:justify-end">
          <div className="bg-[#11161a] border border-[#232c35] rounded-xl p-5 w-full sm:w-auto flex items-center space-x-5">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#232c35]"
                  strokeWidth="3.2"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-400"
                  strokeDasharray="87, 100"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center font-mono">
                <span className="text-xl font-bold text-slate-100">87<span className="text-xs text-slate-400">%</span></span>
                <span className="text-[8px] uppercase tracking-wider text-emerald-400 font-semibold">Ready</span>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Unit Readiness</div>
              <div className="text-base font-bold text-slate-100">Operational</div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">Last assessed 12 min ago</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards Grid matching screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Assets */}
        <div 
          onClick={() => { tacticalAudio.playClick(); onNavigate('assets'); }}
          className="bg-[#11161a] border border-[#232c35] rounded-lg p-4 cursor-pointer hover:border-[#394754] transition space-y-3"
        >
          <div className="w-8 h-8 rounded bg-[#ff5533]/15 text-[#ff5533] flex items-center justify-center">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Active Assets</div>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-1">{activeAssetsCount}</div>
            <div className="text-xs text-slate-400 mt-1">
              <span className="text-[#ff5533]">{attentionAssetsCount} need attention</span>
            </div>
          </div>
        </div>

        {/* Card 2: Personnel */}
        <div 
          onClick={() => { tacticalAudio.playClick(); onNavigate('personnel'); }}
          className="bg-[#11161a] border border-[#232c35] rounded-lg p-4 cursor-pointer hover:border-[#394754] transition space-y-3"
        >
          <div className="w-8 h-8 rounded bg-cyan-950/60 text-cyan-400 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Personnel</div>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-1">{personnel.length}</div>
            <div className="text-xs text-slate-400 mt-1">
              <span className="text-emerald-400">18 present</span> · <span className="text-amber-400">2 unconfirmed</span>
            </div>
          </div>
        </div>

        {/* Card 3: Open Incidents */}
        <div 
          onClick={() => { tacticalAudio.playClick(); onNavigate('incidents'); }}
          className="bg-[#11161a] border border-[#232c35] rounded-lg p-4 cursor-pointer hover:border-[#394754] transition space-y-3"
        >
          <div className="w-8 h-8 rounded bg-amber-950/60 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Open Incidents</div>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-1">{incidents.length}</div>
            <div className="text-xs text-slate-400 mt-1">
              <span className="text-rose-400">{criticalIncidents} critical</span> · <span className="text-amber-300">{monitoringIncidents} monitoring</span>
            </div>
          </div>
        </div>

        {/* Card 4: Pending Sync */}
        <div 
          onClick={() => { tacticalAudio.playClick(); onNavigate('sync'); }}
          className="bg-[#11161a] border border-[#232c35] rounded-lg p-4 cursor-pointer hover:border-[#394754] transition space-y-3"
        >
          <div className="w-8 h-8 rounded bg-emerald-950/60 text-emerald-400 flex items-center justify-center">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Pending Sync</div>
            <div className="text-2xl font-bold font-mono text-slate-100 mt-1">{syncStats.pendingCount}</div>
            <div className="text-xs text-slate-400 mt-1">
              <span className="text-emerald-400">Ready to exchange</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3D Mesh Topology Preview Card */}
      <div className="bg-[#11161a] border border-[#232c35] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-[#ff5533]" />
            <h2 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider">
              Tactical Mesh Live Topology (3D)
            </h2>
          </div>
          <button
            onClick={() => onNavigate('sync')}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
          >
            <span>Full Mesh Inspector</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <MeshTopology3D height="300px" interactive={true} />
      </div>

      {/* Two Column Section: Recent Activity & Readiness Checks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-[#11161a] border border-[#232c35] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#232c35] pb-3">
            <h3 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider">Recent Activity</h3>
            <button 
              onClick={() => onNavigate('incidents')}
              className="text-xs font-mono text-slate-400 hover:text-slate-200"
            >
              View all &gt;
            </button>
          </div>

          <div className="space-y-3">
            {incidents.slice(0, 3).map((inc) => (
              <div key={inc.id} className="p-3 rounded-lg bg-[#161c22] border border-[#232c35] flex items-start justify-between gap-3">
                <div className="flex items-start space-x-2.5">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    inc.severity === 'Critical' ? 'bg-rose-500' : inc.severity === 'High' ? 'bg-amber-400' : 'bg-cyan-400'
                  }`} />
                  <div>
                    <div className="text-xs font-bold text-slate-200 flex items-center space-x-2 font-mono">
                      <span>{inc.incidentCode}</span>
                      <span className="text-slate-400 font-sans font-normal text-[11px]">— {inc.type}</span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5 line-clamp-1">{inc.description}</p>
                    <div className="text-[10px] font-mono text-slate-500 mt-1">{inc.locationSector}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                  inc.status === 'Open' ? 'bg-amber-950/60 text-amber-300 border-amber-800' : 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                }`}>
                  {inc.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Readiness Checks */}
        <div className="bg-[#11161a] border border-[#232c35] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#232c35] pb-3">
            <h3 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider">Readiness Checks</h3>
            <button 
              onClick={() => onNavigate('checklists')}
              className="text-xs font-mono text-slate-400 hover:text-slate-200"
            >
              Open checklists &gt;
            </button>
          </div>

          <div className="space-y-3">
            {checklists.slice(0, 3).map((chk) => {
              const pct = Math.round((chk.progress.completed / chk.progress.total) * 100) || 0;
              return (
                <div 
                  key={chk.id} 
                  onClick={() => onNavigate('checklists')}
                  className="p-3 rounded-lg bg-[#161c22] border border-[#232c35] space-y-2 hover:border-[#394754] cursor-pointer transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">{chk.title}</span>
                    <span className="text-xs font-mono text-slate-400">{chk.progress.completed}/{chk.progress.total}</span>
                  </div>
                  <div className="w-full bg-[#0d1114] h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-400' : 'bg-[#ff5533]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
