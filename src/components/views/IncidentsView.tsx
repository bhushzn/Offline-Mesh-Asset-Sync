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
  Radio,
  X,
  Check,
  Filter
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
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Form State
  const [formType, setFormType] = useState<IncidentType>('Medical Emergency');
  const [formSeverity, setFormSeverity] = useState<IncidentSeverity>('Critical');
  const [formDescription, setFormDescription] = useState('');
  const [formSector, setFormSector] = useState('Sector 4B Ridge');
  const [formReporter, setFormReporter] = useState('Echo-Lead');
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
    const matchStatus = statusFilter === 'ALL' || inc.status === statusFilter;
    return matchSearch && matchSeverity && matchStatus;
  });

  const criticalCount = incidents.filter((i) => i.severity === 'Critical' && i.status !== 'Resolved').length;
  const highCount = incidents.filter((i) => i.severity === 'High' && i.status !== 'Resolved').length;
  const activeCount = incidents.filter((i) => i.status !== 'Resolved').length;
  const resolvedCount = incidents.filter((i) => i.status === 'Resolved').length;

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDescription.trim()) return;

    tacticalAudio.playAlert();

    const codeNum = Math.floor(100 + Math.random() * 900);
    const newInc: Incident = {
      id: `inc-${Date.now()}`,
      incidentCode: `SITREP-${codeNum}`,
      type: formType,
      severity: formSeverity,
      description: formDescription,
      locationSector: formSector,
      reporter: formReporter,
      status: 'Open',
      relatedAssetIds: formRelatedAsset ? [formRelatedAsset] : [],
      relatedPersonnelIds: formRelatedPerson ? [formRelatedPerson] : [],
      reportedAt: Date.now(),
      updatedAt: Date.now(),
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: 1,
      lamportClock: syncQueue.advanceClock().lamport,
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
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: inc.version + 1,
      lamportClock: syncQueue.advanceClock().lamport,
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.INCIDENTS, updated);
    await syncQueue.enqueueMutation('incident', inc.id, 'UPDATE', updated);
    setSelectedIncident(null);
  };

  const resetForm = () => {
    setFormDescription('');
    setFormType('Medical Emergency');
    setFormSeverity('Critical');
    setFormSector('Sector 4B Ridge');
    setFormRelatedAsset('');
    setFormRelatedPerson('');
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & New SITREP action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono font-semibold text-rose-700 uppercase tracking-wider">
            SITREP Logs · High Priority Mesh Broadcast
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Incidents & SITREPs</h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
            Real-time situation reports and hazard tracking across all tactical units.
          </p>
        </div>

        <button
          onClick={() => {
            tacticalAudio.playClick();
            setIsModalOpen(true);
          }}
          className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs sm:text-sm transition flex items-center space-x-1.5 shadow-xs touch-target-min"
        >
          <Plus className="w-4 h-4" />
          <span>Log SITREP</span>
        </button>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-rose-700">Critical Alerts</div>
          <div className="text-xl font-bold text-rose-700 mt-1 font-mono">{criticalCount}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-amber-700">High Priority</div>
          <div className="text-xl font-bold text-amber-700 mt-1 font-mono">{highCount}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-blue-700">Active Incidents</div>
          <div className="text-xl font-bold text-blue-700 mt-1 font-mono">{activeCount}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-emerald-700">Resolved</div>
          <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">{resolvedCount}</div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search SITREPs by code, reporter, description, sector..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-sans shadow-xs"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="flex-1 sm:flex-none bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm rounded-lg px-3 py-2.5 font-medium focus:outline-none shadow-xs"
          >
            <option value="ALL">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm rounded-lg px-3 py-2.5 font-medium focus:outline-none shadow-xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Monitoring">Monitoring</option>
            <option value="Resolved">Resolved</option>
            <option value="Escalated">Escalated</option>
          </select>
        </div>
      </div>

      {/* SITREP Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredIncidents.map((inc) => (
          <div
            key={inc.id}
            onClick={() => {
              tacticalAudio.playClick();
              setSelectedIncident(inc);
            }}
            className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition cursor-pointer space-y-3.5 group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    inc.severity === 'Critical'
                      ? 'bg-rose-500 ring-4 ring-rose-100'
                      : inc.severity === 'High'
                      ? 'bg-amber-500 ring-4 ring-amber-100'
                      : 'bg-blue-500 ring-4 ring-blue-100'
                  }`}
                />
                <div>
                  <div className="font-mono font-bold text-slate-900 text-sm">{inc.incidentCode}</div>
                  <div className="text-xs text-slate-500">{inc.type}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono uppercase ${
                    inc.severity === 'Critical'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : inc.severity === 'High'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}
                >
                  {inc.severity}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono uppercase ${
                    inc.status === 'Resolved'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : inc.status === 'Monitoring'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {inc.status}
                </span>
              </div>
            </div>

            <p className="text-slate-800 text-xs sm:text-sm font-sans leading-relaxed">
              {inc.description}
            </p>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-100">
              <div className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{inc.locationSector}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{formatTime(inc.reportedAt)}</span>
              </div>
            </div>
          </div>
        ))}
        {filteredIncidents.length === 0 && (
          <div className="col-span-full bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs font-mono">
            No incidents found matching current filters.
          </div>
        )}
      </div>

      {/* SITREP Status Update / Detail Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="text-[10px] font-mono uppercase font-semibold text-rose-700">SITREP Details</div>
                <div className="font-bold text-slate-900 text-base">{selectedIncident.incidentCode}</div>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">Situation Report</div>
                <div className="font-medium text-slate-900 leading-relaxed">{selectedIncident.description}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">Reporter:</span>
                  <span className="font-semibold text-slate-800">{selectedIncident.reporter}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Location:</span>
                  <span className="font-semibold text-slate-800">{selectedIncident.locationSector}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Update Incident Status</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Open', 'Monitoring', 'Resolved', 'Escalated'] as IncidentStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleUpdateStatus(selectedIncident, st)}
                      className={`py-2 px-2 rounded-lg text-[11px] font-semibold border touch-target-min transition ${
                        selectedIncident.status === st
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedIncident(null)}
              className="w-full py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Log SITREP Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="text-[10px] font-mono uppercase font-semibold text-rose-700">Immediate Field SITREP</div>
                <h2 className="font-bold text-slate-900 text-lg">Log Incident (SITREP)</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Incident Category</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as IncidentType)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Severity Level</label>
                  <select
                    value={formSeverity}
                    onChange={(e) => setFormSeverity(e.target.value as IncidentSeverity)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / SITREP Body</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe situational status, casualties, assistance required..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sector / Location</label>
                  <input
                    type="text"
                    required
                    placeholder="Sector 4B Ridge"
                    value={formSector}
                    onChange={(e) => setFormSector(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reporting Callsign</label>
                  <input
                    type="text"
                    required
                    placeholder="Echo-Lead"
                    value={formReporter}
                    onChange={(e) => setFormReporter(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-800 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium shadow-xs touch-target-min"
                >
                  Broadcast SITREP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
