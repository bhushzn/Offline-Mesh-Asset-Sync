// FIELDLINK Personnel & Roll Call Operations View
import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  ChevronRight, 
  Shield, 
  MapPin, 
  Play 
} from 'lucide-react';
import { Personnel, RollCallRecord, RollCallStatus, PersonnelStatus } from '../../types/tactical';
import { offlineStorage, STORES } from '../../services/offlineStorageService';
import { syncQueue } from '../../services/syncQueueService';
import { tacticalAudio } from '../../utils/audio';

export const PersonnelView: React.FC = () => {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [latestRollCall, setLatestRollCall] = useState<RollCallRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRollCallModalOpen, setIsRollCallModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeRollCallEntries, setActiveRollCallEntries] = useState<Record<string, RollCallStatus>>({});

  // Add Personnel form state
  const [formName, setFormName] = useState('');
  const [formCallsign, setFormCallsign] = useState('');
  const [formRank, setFormRank] = useState('Specialist');
  const [formUnit, setFormUnit] = useState('Alpha Fireteam');
  const [formRole, setFormRole] = useState('Rifleman');
  const [formBlood, setFormBlood] = useState('O+');
  const [formSector, setFormSector] = useState('Base Alpha');

  useEffect(() => {
    loadData();
    const unsub = offlineStorage.subscribe((store) => {
      if (store === STORES.PERSONNEL || store === STORES.ROLL_CALLS) {
        loadData();
      }
    });
    return () => unsub();
  }, []);

  const loadData = async () => {
    const [pList, rList] = await Promise.all([
      offlineStorage.getAll<Personnel>(STORES.PERSONNEL),
      offlineStorage.getAll<RollCallRecord>(STORES.ROLL_CALLS),
    ]);
    setPersonnel(pList);
    if (rList.length > 0) {
      setLatestRollCall(rList[0]);
    }
  };

  const filteredPersonnel = personnel.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.callsign.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartRollCallSession = () => {
    tacticalAudio.playClick();
    const initialEntries: Record<string, RollCallStatus> = {};
    personnel.forEach((p) => {
      initialEntries[p.id] = p.lastRollCallStatus || 'Present';
    });
    setActiveRollCallEntries(initialEntries);
    setIsRollCallModalOpen(true);
  };

  const handleToggleEntryStatus = (personnelId: string, nextStatus: RollCallStatus) => {
    tacticalAudio.playClick();
    setActiveRollCallEntries((prev) => ({
      ...prev,
      [personnelId]: nextStatus,
    }));
  };

  const handleSaveRollCall = async () => {
    tacticalAudio.playClick();
    const values = Object.values(activeRollCallEntries);
    const summary = {
      total: personnel.length,
      present: values.filter((s) => s === 'Present').length,
      absent: values.filter((s) => s === 'Absent').length,
      missing: values.filter((s) => s === 'Missing').length,
      injured: values.filter((s) => s === 'Injured').length,
      other: values.filter((s) => s === 'Other').length,
    };

    const entriesMap: RollCallRecord['entries'] = {};
    for (const p of personnel) {
      const status = activeRollCallEntries[p.id] || 'Present';
      entriesMap[p.id] = {
        personnelId: p.id,
        personnelName: p.name,
        status,
        timestamp: Date.now(),
      };

      // Also update individual personnel lastRollCallStatus
      const updatedP: Personnel = {
        ...p,
        lastRollCallStatus: status,
        updatedAt: Date.now(),
        updatedByDeviceId: syncQueue.getDeviceId(),
        version: p.version + 1,
        lamportClock: syncQueue.advanceClock(),
        syncStatus: 'pending',
      };
      await offlineStorage.put(STORES.PERSONNEL, updatedP, true);
    }

    const newRollCall: RollCallRecord = {
      id: `rc-${Date.now()}`,
      title: 'Squad Tactical Roll Call',
      sector: 'North Operational Sector',
      startedAt: Date.now() - 1000 * 60 * 5,
      completedAt: Date.now(),
      operatorName: 'Lina Okafor',
      deviceId: syncQueue.getDeviceId(),
      status: 'Completed',
      entries: entriesMap,
      summary,
      updatedAt: Date.now(),
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: 1,
      lamportClock: syncQueue.advanceClock(),
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.ROLL_CALLS, newRollCall);
    await syncQueue.enqueueMutation('roll_call', newRollCall.id, 'CREATE', newRollCall);

    setLatestRollCall(newRollCall);
    setIsRollCallModalOpen(false);
    tacticalAudio.playSyncSuccess();
  };

  const handleCreatePersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) return;

    tacticalAudio.playClick();
    const newPerson: Personnel = {
      id: `pers-${Date.now()}`,
      callsign: formCallsign || formName.substring(0, 3).toUpperCase(),
      name: formName,
      rank: formRank,
      unit: formUnit,
      role: formRole,
      bloodType: formBlood,
      status: 'Active',
      currentSector: formSector,
      equipmentCount: 1,
      lastRollCallStatus: 'Present',
      updatedAt: Date.now(),
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: 1,
      lamportClock: syncQueue.advanceClock(),
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.PERSONNEL, newPerson);
    await syncQueue.enqueueMutation('personnel', newPerson.id, 'CREATE', newPerson);

    setIsAddModalOpen(false);
    setFormName('');
    setFormCallsign('');
    tacticalAudio.playSyncSuccess();
  };

  const accountedCount = latestRollCall ? latestRollCall.summary.present : 18;
  const totalRosterCount = latestRollCall ? latestRollCall.summary.total : 20;
  const unconfirmedCount = totalRosterCount - accountedCount;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb Context */}
      <div>
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          Local Data Store / IndexedDB
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-sans">Personnel / Roll Call</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Know who is accounted for, wherever the team is deployed.
            </p>
          </div>

          <button
            onClick={() => {
              tacticalAudio.playClick();
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 rounded-md bg-[#ff5533] hover:bg-[#e64422] text-white font-semibold text-xs sm:text-sm transition flex items-center justify-center space-x-1.5 shadow-tactical-glow self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add personnel</span>
          </button>
        </div>
      </div>

      {/* Latest Roll Call Card matching screenshot */}
      <div className="bg-[#11161a] border border-[#232c35] rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Latest Roll Call</div>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-100">{accountedCount}</span>
              <span className="text-slate-400 text-xs sm:text-sm font-mono">/ {totalRosterCount} accounted</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-xs font-mono">
              <span className="text-emerald-400 font-bold">{accountedCount} PRESENT</span>
              <span className="text-slate-600 mx-2">•</span>
              <span className="text-amber-400 font-bold">{unconfirmedCount} UNCONFIRMED</span>
            </div>

            <button
              onClick={handleStartRollCallSession}
              className="px-3.5 py-2 rounded bg-[#161c22] border border-[#232c35] hover:border-[#ff5533]/50 text-slate-200 text-xs font-mono font-bold transition flex items-center space-x-1.5"
            >
              <span>Start roll call</span>
              <span className="text-[#ff5533]">↳</span>
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#0d1114] h-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.round((accountedCount / totalRosterCount) * 100))}%` }}
          />
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search records"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#11161a] border border-[#232c35] rounded-md pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
        />
      </div>

      {/* Personnel Roster List matching screenshot */}
      <div className="space-y-2">
        {filteredPersonnel.map((person) => {
          const initials = person.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase();
          const isPresent = person.lastRollCallStatus === 'Present' || person.status === 'Active';

          return (
            <div
              key={person.id}
              className="bg-[#11161a] border border-[#232c35] hover:border-[#394754] rounded-lg p-3.5 flex items-center justify-between transition-colors group cursor-pointer"
            >
              <div className="flex items-center space-x-3.5">
                {/* Initials Avatar matching screenshot */}
                <div className="w-9 h-9 rounded bg-[#161c22] border border-[#232c35] flex items-center justify-center font-mono font-bold text-xs text-slate-300">
                  {initials}
                </div>

                <div>
                  <div className="text-sm font-bold text-slate-100 font-sans flex items-center space-x-2">
                    <span>{person.name}</span>
                    <span className="text-[10px] font-mono text-slate-400 font-normal">({person.callsign})</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">{person.role} · {person.unit}</div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span
                  className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                    isPresent
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                      : 'bg-amber-950/60 text-amber-400 border border-amber-800'
                  }`}
                >
                  {person.lastRollCallStatus || 'PRESENT'}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-300 transition" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Roll Call Session Modal */}
      {isRollCallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-2xl bg-[#11161a] border border-[#232c35] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#232c35] bg-[#161c22] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center space-x-2">
                  <Users className="w-4 h-4 text-[#ff5533]" />
                  <span>LIVE ROLL CALL SESSION</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">Tap status buttons to verify squad presence offline</p>
              </div>
              <button onClick={() => setIsRollCallModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {personnel.map((p) => {
                const currentStatus = activeRollCallEntries[p.id] || 'Present';
                return (
                  <div key={p.id} className="p-3 bg-[#161c22] border border-[#232c35] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-100 font-sans">{p.name} ({p.rank})</div>
                      <div className="text-[11px] text-slate-400 font-mono">{p.role} · Sector: {p.currentSector}</div>
                    </div>

                    {/* Quick status selector */}
                    <div className="flex items-center space-x-1.5 font-mono text-[10px]">
                      {(['Present', 'Absent', 'Missing', 'Injured'] as RollCallStatus[]).map((status) => {
                        const isSelected = currentStatus === status;
                        return (
                          <button
                            key={status}
                            onClick={() => handleToggleEntryStatus(p.id, status)}
                            className={`px-2 py-1 rounded transition font-bold ${
                              isSelected
                                ? status === 'Present'
                                  ? 'bg-emerald-500 text-slate-900'
                                  : status === 'Absent'
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-amber-500 text-slate-900'
                                : 'bg-[#0d1114] text-slate-400 border border-[#232c35] hover:text-slate-200'
                            }`}
                          >
                            {status}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-[#232c35] bg-[#0d1114] flex items-center justify-between">
              <div className="text-xs font-mono text-slate-400">
                Total: {personnel.length} operators
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsRollCallModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-[#161c22] text-slate-300 text-xs font-mono"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRollCall}
                  className="px-4 py-1.5 rounded bg-[#ff5533] text-white font-bold text-xs font-mono shadow-tactical-glow"
                >
                  Sign & Commit Roll Call
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Personnel Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#11161a] border border-[#232c35] rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#232c35] pb-3">
              <h3 className="text-base font-bold text-slate-100 font-mono">Register Personnel</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreatePersonnel} className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marcus Vance"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100 focus:outline-none focus:border-[#ff5533]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Callsign</label>
                  <input
                    type="text"
                    placeholder="Ghost-4"
                    value={formCallsign}
                    onChange={(e) => setFormCallsign(e.target.value)}
                    className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Rank</label>
                  <input
                    type="text"
                    value={formRank}
                    onChange={(e) => setFormRank(e.target.value)}
                    className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Unit</label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Role</label>
                  <input
                    type="text"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#232c35]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-[#161c22] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#ff5533] text-white font-semibold"
                >
                  Save Operator
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
