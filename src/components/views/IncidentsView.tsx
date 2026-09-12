// FIELDLINK Tactical Incidents & SITREP Logger View
import React, { useEffect, useState } from 'react';
import { 
  AlertTriangle, 
  Plus, 
  Search, 
  MapPin, 
  Clock, 
  User, 
  Package, 
  ShieldAlert, 
  CheckCircle2, 
  Radio 
} from 'lucide-react';
import { Incident, IncidentSeverity, IncidentType, IncidentStatus, Asset, Personnel } from '../../types/tactical';
import { offlineStorage, STORES } from '../../services/offlineStorageService';
import { syncQueue } from '../../services/syncQueueService';
import { tacticalAudio } from '../../utils/audio';

export const IncidentsView: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Form State
  const [formType, setFormType] = useState<IncidentType>('Medical Emergency');
  const [formSeverity, setFormSeverity] = useState<IncidentSeverity>('Critical');
  const [formDescription, setFormDescription] = useState('');
  const [formSector, setFormSector] = useState('Sector-4B Ridge');
  const [formReporter, setFormReporter] = useState('Elena Rostova (Combat Medic)');
  const [formRelatedAsset, setFormRelatedAsset] = useState('');
  const [formRelatedPerson, setFormRelatedPerson] = useState('');

  useEffect(() => {
    loadData();
    const unsub = offlineStorage.subscribe((store) => {
      if (store === STORES.INCIDENTS) loadData();
    });
    return () => unsub();
  }, []);

  const loadData = async () => {
    const [incList, aList, pList] = await Promise.all([
      offlineStorage.getAll<Incident>(STORES.INCIDENTS),
      offlineStorage.getAll<Asset>(STORES.ASSETS),
      offlineStorage.getAll<Personnel>(STORES.PERSONNEL),
    ]);
    setIncidents(incList);
    setAssets(aList);
    setPersonnel(pList);
  };

  const filteredIncidents = incidents.filter((inc) => {
    const matchSearch =
      inc.incidentCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.locationSector.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.reporter.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSeverity = severityFilter === 'ALL' || inc.severity === severityFilter;
    return matchSearch && matchSeverity;
  });

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescription.trim()) return;

    tacticalAudio.playAlert();

    const codeNum = Math.floor(100 + Math.random() * 900);
    const newInc: Incident = {
      id: `inc-${Date.now()}`,
      incidentCode: `INC-${codeNum}`,
      type: formType,
      severity: formSeverity,
      description: formDescription,
      locationSector: formSector,
      coordinates: { lat: 34.0522 + (Math.random() - 0.5) * 0.05, lng: -118.2437 + (Math.random() - 0.5) * 0.05 },
      reporter: formReporter,
      relatedPersonnelIds: formRelatedPerson ? [formRelatedPerson] : [],
      relatedAssetIds: formRelatedAsset ? [formRelatedAsset] : [],
      status: 'Open',
      reportedAt: Date.now(),
      updatedAt: Date.now(),
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: 1,
      lamportClock: syncQueue.advanceClock(),
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.INCIDENTS, newInc);
    await syncQueue.enqueueMutation('incident', newInc.id, 'CREATE', newInc);

    setIsModalOpen(false);
    resetForm();
    tacticalAudio.playSyncSuccess();
  };

  const handleUpdateStatus = async (inc: Incident, newStatus: IncidentStatus) => {
    tacticalAudio.playClick();
    const updated: Incident = {
      ...inc,
      status: newStatus,
      updatedAt: Date.now(),
      resolvedAt: newStatus === 'Resolved' ? Date.now() : undefined,
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: inc.version + 1,
      lamportClock: syncQueue.advanceClock(),
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.INCIDENTS, updated);
    await syncQueue.enqueueMutation('incident', inc.id, 'UPDATE', updated);
    setSelectedIncident(null);
  };

  const resetForm = () => {
    setFormDescription('');
    setFormSeverity('Critical');
    setFormType('Medical Emergency');
  };

  const getSeverityBadge = (severity: IncidentSeverity) => {
    switch (severity) {
      case 'Critical':
        return 'bg-rose-950/70 text-rose-400 border border-rose-800';
      case 'High':
        return 'bg-amber-950/70 text-amber-400 border border-amber-800';
      case 'Medium':
        return 'bg-yellow-950/70 text-yellow-400 border border-yellow-800';
      default:
        return 'bg-cyan-950/70 text-cyan-400 border border-cyan-800';
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Context */}
      <div>
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          Local Data Store / IndexedDB
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-sans">Incidents & SITREPs</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Tactical casualty logs, equipment failures and perimeter alerts reported offline.
            </p>
          </div>

          <button
            onClick={() => {
              tacticalAudio.playClick();
              setIsModalOpen(true);
            }}
            className="px-4 py-2 rounded-md bg-[#ff5533] hover:bg-[#e64422] text-white font-semibold text-xs sm:text-sm transition flex items-center justify-center space-x-1.5 shadow-tactical-glow self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Log incident</span>
          </button>
        </div>
      </div>

      {/* Search & Severity Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search incidents or sectors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#11161a] border border-[#232c35] rounded-md pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="bg-[#11161a] border border-[#232c35] text-slate-300 text-xs rounded-md px-3 py-2 font-mono focus:outline-none w-full sm:w-auto"
        >
          <option value="ALL">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {/* Incidents List */}
      <div className="space-y-3">
        {filteredIncidents.map((inc) => (
          <div
            key={inc.id}
            onClick={() => {
              tacticalAudio.playClick();
              setSelectedIncident(inc);
            }}
            className="bg-[#11161a] border border-[#232c35] hover:border-[#394754] rounded-xl p-4 sm:p-5 transition cursor-pointer group space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2.5">
                <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${getSeverityBadge(inc.severity)}`}>
                  {inc.severity}
                </span>
                <span className="font-mono font-bold text-slate-100 text-sm">{inc.incidentCode}</span>
                <span className="text-slate-500 font-mono text-xs">•</span>
                <span className="text-xs font-mono text-slate-300">{inc.type}</span>
              </div>

              <div className="flex items-center space-x-2 text-[11px] font-mono">
                <span className="text-slate-400">{formatTime(inc.reportedAt)}</span>
                <span className={`px-2 py-0.5 rounded uppercase font-bold text-[10px] ${
                  inc.status === 'Open' ? 'bg-amber-950/60 text-amber-300 border border-amber-800' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                }`}>
                  {inc.status}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
              {inc.description}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-2 border-t border-[#232c35]/60">
              <div className="flex items-center space-x-1 text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-[#ff5533]" />
                <span>{inc.locationSector}</span>
              </div>
              <div className="flex items-center space-x-1">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>{inc.reporter}</span>
              </div>
              <div className="text-[10px] text-slate-500">
                Node: {inc.updatedByDeviceId.replace('device-', '').toUpperCase()} (Lamport {inc.lamportClock})
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Log Incident Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#11161a] border border-[#232c35] rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#232c35] pb-3">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-[#ff5533]" />
                <span>Log Tactical Incident (Offline)</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Incident Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                  >
                    <option value="Medical Emergency">Medical Emergency</option>
                    <option value="Equipment Failure">Equipment Failure</option>
                    <option value="Comms Blackout">Comms Blackout</option>
                    <option value="Perimeter Alert">Perimeter Alert</option>
                    <option value="Hazard Warning">Hazard Warning</option>
                    <option value="Supply Shortage">Supply Shortage</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Severity Level</label>
                  <select
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value as any)}
                    className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                  >
                    <option value="Critical">Critical (Red)</option>
                    <option value="High">High (Amber)</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Location / Sector</label>
                <input
                  type="text"
                  required
                  value={formSector}
                  onChange={(e) => setFormSector(e.target.value)}
                  className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Reporter Callsign / Name</label>
                <input
                  type="text"
                  required
                  value={formReporter}
                  onChange={(e) => setFormReporter(e.target.value)}
                  className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Incident SITREP Details</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe emergency, casualties, immediate actions taken..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#232c35]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-[#161c22] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#ff5533] text-white font-semibold shadow-tactical-glow"
                >
                  Broadcast & Log Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incident Details & Triage Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#11161a] border border-[#232c35] rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#232c35] pb-3">
              <div>
                <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${getSeverityBadge(selectedIncident.severity)}`}>
                  {selectedIncident.severity}
                </span>
                <h3 className="text-base font-bold text-slate-100 font-mono mt-1">{selectedIncident.incidentCode}</h3>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs font-sans text-slate-200 p-3 rounded bg-[#161c22] leading-relaxed">
              {selectedIncident.description}
            </p>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Sector:</span>
                <span className="text-slate-200">{selectedIncident.locationSector}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Reporter:</span>
                <span className="text-slate-200">{selectedIncident.reporter}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Origin Node:</span>
                <span className="text-cyan-400">{selectedIncident.updatedByDeviceId}</span>
              </div>
            </div>

            <div className="border-t border-[#232c35] pt-3 space-y-2">
              <div className="text-[11px] font-mono text-slate-400 uppercase">Update Incident Status:</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleUpdateStatus(selectedIncident, 'Monitoring')}
                  className="p-2 rounded bg-amber-950/60 border border-amber-800 text-amber-300 text-xs font-mono font-bold"
                >
                  Monitor
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedIncident, 'Resolved')}
                  className="p-2 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-mono font-bold"
                >
                  Resolve
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedIncident, 'Escalated')}
                  className="p-2 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-mono font-bold"
                >
                  Escalate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
