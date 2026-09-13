// FIELDLINK Tactical Operational Checklists View
import React, { useEffect, useState, useCallback } from 'react';
import { 
  Plus, 
  RotateCcw,
  Check,
  X
} from 'lucide-react';
import { ChecklistExecution, ChecklistCategory, ChecklistItem } from '../../types/tactical';
import { offlineStorage, STORES } from '../../services/offlineStorageService';
import { syncQueue } from '../../services/syncQueueService';
import { tacticalAudio } from '../../utils/audio';

export const ChecklistsView: React.FC = () => {
  const [checklists, setChecklists] = useState<ChecklistExecution[]>([]);
  const [activeChecklist, setActiveChecklist] = useState<ChecklistExecution | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // New checklist form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<ChecklistCategory>('Equipment Inspection');
  const [rawItems, setRawItems] = useState('Check primary HF/VHF radio comms\nVerify GPS coordinates and compass heading\nInspect vehicle battery voltage (>12.6V)\nVerify trauma kit seal integrity');

  const loadChecklists = useCallback(async () => {
    const list = await offlineStorage.getAll<ChecklistExecution>(STORES.CHECKLISTS);
    setChecklists(list);
    setActiveChecklist((prev) => {
      if (!prev && list.length > 0) return list[0];
      if (prev) {
        const updated = list.find((c) => c.id === prev.id);
        return updated || prev;
      }
      return null;
    });
  }, []);

  useEffect(() => {
    loadChecklists();
    const unsub = offlineStorage.subscribe((store) => {
      if (store === STORES.CHECKLISTS) loadChecklists();
    });
    return () => unsub();
  }, [loadChecklists]);

  const handleToggleItem = async (checklistId: string, itemId: string) => {
    tacticalAudio.playClick();
    const target = checklists.find((c) => c.id === checklistId);
    if (!target) return;

    const updatedItems = target.items.map((item) => {
      if (item.id === itemId) {
        const nextState = !item.completed;
        return {
          ...item,
          completed: nextState,
          completedBy: nextState ? syncQueue.getDeviceId() : undefined,
          completedAt: nextState ? Date.now() : undefined,
        };
      }
      return item;
    });

    const completedCount = updatedItems.filter((i) => i.completed).length;

    const updatedChecklist: ChecklistExecution = {
      ...target,
      items: updatedItems,
      progress: {
        completed: completedCount,
        total: updatedItems.length,
      },
      status: completedCount === updatedItems.length ? 'Completed' : 'In Progress',
      updatedAt: Date.now(),
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: target.version + 1,
      lamportClock: syncQueue.advanceClock().lamport,
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.CHECKLISTS, updatedChecklist);
    await syncQueue.enqueueMutation('checklist', target.id, 'UPDATE', updatedChecklist);

    setActiveChecklist(updatedChecklist);
    if (completedCount === updatedItems.length) {
      tacticalAudio.playSyncSuccess();
    }
  };

  const handleResetChecklist = async (checklist: ChecklistExecution) => {
    tacticalAudio.playClick();
    const resetItems = checklist.items.map((i) => ({
      ...i,
      completed: false,
      completedBy: undefined,
      completedAt: undefined,
    }));

    const updatedChecklist: ChecklistExecution = {
      ...checklist,
      items: resetItems,
      progress: {
        completed: 0,
        total: resetItems.length,
      },
      status: 'In Progress',
      updatedAt: Date.now(),
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: checklist.version + 1,
      lamportClock: syncQueue.advanceClock().lamport,
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.CHECKLISTS, updatedChecklist);
    await syncQueue.enqueueMutation('checklist', checklist.id, 'UPDATE', updatedChecklist);
    setActiveChecklist(updatedChecklist);
  };

  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    tacticalAudio.playClick();
    const parsedItems: ChecklistItem[] = rawItems
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((text, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        label: text,
        completed: false,
      }));

    const newChecklist: ChecklistExecution = {
      id: `chk-${Date.now()}`,
      title: newTitle,
      category: newCategory,
      status: 'In Progress',
      items: parsedItems,
      progress: {
        completed: 0,
        total: parsedItems.length,
      },
      updatedAt: Date.now(),
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: 1,
      lamportClock: syncQueue.advanceClock().lamport,
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.CHECKLISTS, newChecklist);
    await syncQueue.enqueueMutation('checklist', newChecklist.id, 'CREATE', newChecklist);

    setIsNewModalOpen(false);
    setNewTitle('');
    setActiveChecklist(newChecklist);
    tacticalAudio.playSyncSuccess();
  };

  const totalChecklists = checklists.length;
  const completedChecklists = checklists.filter((c) => c.status === 'Completed').length;
  const inProgressChecklists = checklists.filter((c) => c.status === 'In Progress').length;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono font-semibold text-blue-700 uppercase tracking-wider">
            Operational Procedures · Deterministic CRDT
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Tactical Checklists</h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
            Mission pre-flight verifications, maintenance protocols, and safety compliance.
          </p>
        </div>

        <button
          onClick={() => {
            tacticalAudio.playClick();
            setIsNewModalOpen(true);
          }}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm transition flex items-center space-x-1.5 shadow-xs touch-target-min"
        >
          <Plus className="w-4 h-4" />
          <span>New Checklist</span>
        </button>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-slate-500">Total Checklists</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{totalChecklists}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-blue-700">In Progress</div>
          <div className="text-xl font-bold text-blue-700 mt-1 font-mono">{inProgressChecklists}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-emerald-700">Completed</div>
          <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">{completedChecklists}</div>
        </div>
      </div>

      {/* Split View: List on left / Active Execution on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: All Checklists */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-500">
            Available Protocols ({checklists.length})
          </h2>
          <div className="space-y-2.5">
            {checklists.map((chk) => {
              const isSelected = activeChecklist?.id === chk.id;
              const percent = Math.round((chk.progress.completed / (chk.progress.total || 1)) * 100);
              return (
                <div
                  key={chk.id}
                  onClick={() => {
                    tacticalAudio.playClick();
                    setActiveChecklist(chk);
                  }}
                  className={`p-4 rounded-xl border transition cursor-pointer space-y-2 shadow-xs ${
                    isSelected
                      ? 'bg-blue-50/50 border-blue-500 ring-1 ring-blue-500/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{chk.title}</div>
                      <div className="text-[11px] text-slate-500">{chk.category}</div>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono uppercase ${
                        chk.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {chk.status}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>{chk.progress.completed}/{chk.progress.total} Steps</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          chk.status === 'Completed' ? 'bg-emerald-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Checklist Interactive Sheet */}
        <div className="lg:col-span-7">
          {activeChecklist ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
              <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                <div>
                  <div className="text-[10px] font-mono uppercase font-semibold text-blue-700">Protocol Execution</div>
                  <h2 className="text-xl font-bold text-slate-900">{activeChecklist.title}</h2>
                  <div className="text-xs text-slate-500 mt-0.5">{activeChecklist.category}</div>
                </div>

                <button
                  onClick={() => handleResetChecklist(activeChecklist)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium flex items-center space-x-1.5 touch-target-min"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>

              {/* Progress summary banner */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-semibold">
                  <span className="text-slate-700">Completion Status</span>
                  <span className={activeChecklist.status === 'Completed' ? 'text-emerald-700' : 'text-blue-700'}>
                    {activeChecklist.progress.completed} of {activeChecklist.progress.total} Complete (
                    {Math.round((activeChecklist.progress.completed / (activeChecklist.progress.total || 1)) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      activeChecklist.status === 'Completed' ? 'bg-emerald-500' : 'bg-blue-600'
                    }`}
                    style={{
                      width: `${Math.round((activeChecklist.progress.completed / (activeChecklist.progress.total || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Interactive Checklist Item Rows (44px min touch target) */}
              <div className="space-y-2">
                {activeChecklist.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggleItem(activeChecklist.id, item.id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition flex items-center space-x-3.5 touch-target-min ${
                      item.completed
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center border transition flex-shrink-0 ${
                        item.completed
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {item.completed && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>

                    <div className="flex-1">
                      <span
                        className={`text-xs sm:text-sm font-medium ${
                          item.completed ? 'text-slate-500 line-through' : 'text-slate-900'
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.completed && (
                        <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                          Verified by {item.completedBy || 'Operator'}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-xs font-mono">
              Select a checklist from the list to view and verify items.
            </div>
          )}
        </div>
      </div>

      {/* New Checklist Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="text-[10px] font-mono uppercase font-semibold text-blue-700">New Operational Protocol</div>
                <h2 className="font-bold text-slate-900 text-lg">Create Tactical Checklist</h2>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateChecklist} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Checklist Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Night Patrol Readiness Check"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ChecklistCategory)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Equipment Inspection">Equipment Inspection</option>
                  <option value="Deployment Prep">Deployment Prep</option>
                  <option value="Emergency Response">Emergency Response</option>
                  <option value="Medical Triage">Medical Triage</option>
                  <option value="Vehicle Check">Vehicle Check</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Verification Items (one per line)
                </label>
                <textarea
                  rows={4}
                  required
                  value={rawItems}
                  onChange={(e) => setRawItems(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-800 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-xs touch-target-min"
                >
                  Create Protocol
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
