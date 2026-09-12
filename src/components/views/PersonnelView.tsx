// FIELDLINK Personnel & Muster Roll Operations View
import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Shield, 
  MapPin, 
  Play, 
  X,
  Check,
  UserCheck,
  HeartPulse
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
      setLatestRollCall(rList[rList.length - 1]);
    }
  };

  const filteredPersonnel = personnel.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.callsign.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.unit.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCount = personnel.length;
  const presentCount = personnel.filter((p) => p.lastRollCallStatus === 'Present').length;
  const unconfirmedCount = personnel.filter((p) => !p.lastRollCallStatus || p.lastRollCallStatus === 'Other').length;
  const absentCount = personnel.filter((p) => p.lastRollCallStatus === 'Absent' || p.lastRollCallStatus === 'Missing').length;

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

  const handleMarkAll = (status: RollCallStatus) => {
    tacticalAudio.playClick();
    const updated: Record<string, RollCallStatus> = {};
    personnel.forEach((p) => {
      updated[p.id] = status;
    });
    setActiveRollCallEntries(updated);
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

      // Also update individual personnel record
      const updatedPerson: Personnel = {
        ...p,
        lastRollCallStatus: status,
        updatedAt: Date.now(),
        updatedByDeviceId: syncQueue.getDeviceId(),
        version: p.version + 1,
        lamportClock: syncQueue.advanceClock().lamport,
        syncStatus: 'pending',
      };
      await offlineStorage.put(STORES.PERSONNEL, updatedPerson);
      await syncQueue.enqueueMutation('personnel', p.id, 'UPDATE', updatedPerson);
    }

    const newRollCall: RollCallRecord = {
      id: `rollcall-${Date.now()}`,
      title: 'Field Muster Roll',
      startedAt: Date.now(),
      completedAt: Date.now(),
      operatorName: 'Field Operator',
      deviceId: syncQueue.getDeviceId(),
      status: 'Completed',
      sector: 'Sector 4 Base',
      summary,
      entries: entriesMap,
      updatedAt: Date.now(),
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: 1,
      lamportClock: syncQueue.advanceClock().lamport,
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.ROLL_CALLS, newRollCall);
    await syncQueue.enqueueMutation('roll_call', newRollCall.id, 'CREATE', newRollCall);

    setIsRollCallModalOpen(false);
    tacticalAudio.playSyncSuccess();
  };

  const handleCreatePersonnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formCallsign) return;

    tacticalAudio.playClick();

    const newPerson: Personnel = {
      id: `person-${Date.now()}`,
      name: formName,
      callsign: formCallsign.toUpperCase(),
      rank: formRank,
      unit: formUnit,
      role: formRole,
      status: 'Active',
      bloodType: formBlood,
      lastRollCallStatus: 'Present',
      currentSector: formSector,
      equipmentCount: 0,
      updatedAt: Date.now(),
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: 1,
      lamportClock: syncQueue.advanceClock().lamport,
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.PERSONNEL, newPerson);
    await syncQueue.enqueueMutation('personnel', newPerson.id, 'CREATE', newPerson);

    setIsAddModalOpen(false);
    setFormName('');
    setFormCallsign('');
    tacticalAudio.playSyncSuccess();
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Roll Call Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono font-semibold text-blue-700 uppercase tracking-wider">
            Muster Accountability · CRDT Synced
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Personnel & Muster Roll</h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
            Unit headcount, operational readiness, and real-time roll call status.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleStartRollCallSession}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm transition flex items-center space-x-1.5 shadow-xs touch-target-min"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Start Roll Call</span>
          </button>

          <button
            onClick={() => {
              tacticalAudio.playClick();
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm transition flex items-center space-x-1.5 shadow-xs touch-target-min"
          >
            <Plus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-slate-500">Total Personnel</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{totalCount}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-emerald-700">Present / Accounted</div>
          <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">{presentCount}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-amber-700">Unconfirmed</div>
          <div className="text-xl font-bold text-amber-700 mt-1 font-mono">{unconfirmedCount}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-rose-700">Absent / Missing</div>
          <div className="text-xl font-bold text-rose-700 mt-1 font-mono">{absentCount}</div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search personnel by name, callsign, role, or unit..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans shadow-xs"
        />
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono">
            <tr>
              <th className="py-3 px-4 uppercase font-semibold text-[10px]">Callsign & Name</th>
              <th className="py-3 px-4 uppercase font-semibold text-[10px]">Rank & Role</th>
              <th className="py-3 px-4 uppercase font-semibold text-[10px]">Unit & Sector</th>
              <th className="py-3 px-4 uppercase font-semibold text-[10px]">Blood Type</th>
              <th className="py-3 px-4 uppercase font-semibold text-[10px]">Muster Status</th>
              <th className="py-3 px-4 uppercase font-semibold text-[10px] text-right">Quick Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPersonnel.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="py-3.5 px-4">
                  <div className="font-mono font-bold text-slate-900 text-xs">{p.callsign}</div>
                  <div className="text-slate-600 text-[11px]">{p.name}</div>
                </td>
                <td className="py-3.5 px-4">
                  <div className="font-medium text-slate-900">{p.rank}</div>
                  <div className="text-slate-500 text-[11px]">{p.role}</div>
                </td>
                <td className="py-3.5 px-4 text-slate-600">
                  <div className="font-medium text-slate-900">{p.unit}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{p.currentSector}</div>
                </td>
                <td className="py-3.5 px-4">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                    {p.bloodType || 'O+'}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase font-mono ${
                      p.lastRollCallStatus === 'Present'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : p.lastRollCallStatus === 'Injured'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : p.lastRollCallStatus === 'Absent'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {p.lastRollCallStatus || 'Unconfirmed'}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                    <button
                      onClick={async () => {
                        tacticalAudio.playClick();
                        const updated: Personnel = {
                          ...p,
                          lastRollCallStatus: 'Present',
                          updatedAt: Date.now(),
                          version: p.version + 1,
                        };
                        await offlineStorage.put(STORES.PERSONNEL, updated);
                        await syncQueue.enqueueMutation('personnel', p.id, 'UPDATE', updated);
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                        p.lastRollCallStatus === 'Present' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-emerald-700'
                      }`}
                    >
                      Present
                    </button>
                    <button
                      onClick={async () => {
                        tacticalAudio.playClick();
                        const updated: Personnel = {
                          ...p,
                          lastRollCallStatus: 'Absent',
                          updatedAt: Date.now(),
                          version: p.version + 1,
                        };
                        await offlineStorage.put(STORES.PERSONNEL, updated);
                        await syncQueue.enqueueMutation('personnel', p.id, 'UPDATE', updated);
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition ${
                        p.lastRollCallStatus === 'Absent' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:text-amber-700'
                      }`}
                    >
                      Absent
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (Optimized for 44px touch targets) */}
      <div className="md:hidden space-y-3">
        {filteredPersonnel.map((p) => (
          <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono font-bold text-slate-900 text-sm">{p.callsign} · {p.name}</div>
                <div className="text-xs text-slate-600">{p.rank} · {p.role}</div>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono uppercase ${
                  p.lastRollCallStatus === 'Present'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : p.lastRollCallStatus === 'Injured'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {p.lastRollCallStatus || 'Unconfirmed'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
              {(['Present', 'Absent', 'Injured'] as RollCallStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={async () => {
                    tacticalAudio.playClick();
                    const updated: Personnel = {
                      ...p,
                      lastRollCallStatus: status,
                      updatedAt: Date.now(),
                      version: p.version + 1,
                    };
                    await offlineStorage.put(STORES.PERSONNEL, updated);
                    await syncQueue.enqueueMutation('personnel', p.id, 'UPDATE', updated);
                  }}
                  className={`py-2.5 px-2 rounded-lg text-xs font-semibold touch-target-min border transition ${
                    p.lastRollCallStatus === status
                      ? status === 'Present'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : status === 'Injured'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Roll Call Session Modal */}
      {isRollCallModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="text-[10px] font-mono uppercase font-semibold text-emerald-700">Active Muster Session</div>
                <h2 className="font-bold text-slate-900 text-lg">Conduct Unit Roll Call</h2>
              </div>
              <button
                onClick={() => setIsRollCallModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Batch Controls */}
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-xs font-medium text-slate-700">Batch Set All:</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleMarkAll('Present')}
                  className="px-3 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-semibold hover:bg-emerald-200"
                >
                  All Present
                </button>
                <button
                  type="button"
                  onClick={() => handleMarkAll('Absent')}
                  className="px-3 py-1 rounded bg-amber-100 text-amber-800 text-xs font-semibold hover:bg-amber-200"
                >
                  All Absent
                </button>
              </div>
            </div>

            {/* Scrollable list of roster entries */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
              {personnel.map((p) => {
                const currentStatus = activeRollCallEntries[p.id] || 'Present';
                return (
                  <div key={p.id} className="pt-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900 text-xs">{p.callsign} · {p.name}</div>
                      <div className="text-[10px] text-slate-500">{p.unit} · {p.role}</div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {(['Present', 'Absent', 'Injured'] as RollCallStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleToggleEntryStatus(p.id, st)}
                          className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition touch-target-min ${
                            currentStatus === st
                              ? st === 'Present'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : st === 'Injured'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-amber-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsRollCallModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-800 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRollCall}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs touch-target-min"
              >
                Commit Muster Roll
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Personnel Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="text-[10px] font-mono uppercase font-semibold text-blue-700">Roster Management</div>
                <h2 className="font-bold text-slate-900 text-lg">Add Personnel</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePersonnel} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Callsign</label>
                  <input
                    type="text"
                    required
                    placeholder="EAGLE-1"
                    value={formCallsign}
                    onChange={(e) => setFormCallsign(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Capt. John Doe"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rank</label>
                  <input
                    type="text"
                    placeholder="Sergeant"
                    value={formRank}
                    onChange={(e) => setFormRank(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit / Fireteam</label>
                  <input
                    type="text"
                    placeholder="Alpha Fireteam"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <input
                    type="text"
                    placeholder="Medic"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Group</label>
                  <input
                    type="text"
                    placeholder="O+"
                    value={formBlood}
                    onChange={(e) => setFormBlood(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-800 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs touch-target-min"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
