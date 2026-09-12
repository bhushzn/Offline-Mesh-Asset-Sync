// FIELDLINK Tactical Operational Checklists View
import React, { useEffect, useState } from 'react';
import { 
  CheckSquare, 
  Plus, 
  CheckCircle2, 
  Clock, 
  MoreHorizontal, 
  ChevronRight, 
  Sliders, 
  RotateCcw,
  Check
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
  const [rawItems, setRawItems] = useState('Check primary comms\nVerify GPS coordinates\nCheck battery level\nInspect antenna');

  useEffect(() => {
    loadChecklists();
    const unsub = offlineStorage.subscribe((store) => {
      if (store === STORES.CHECKLISTS) loadChecklists();
    });
    return () => unsub();
  }, []);

  const loadChecklists = async () => {
    const list = await offlineStorage.getAll<ChecklistExecution>(STORES.CHECKLISTS);
    setChecklists(list);
  };

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
      lamportClock: syncQueue.advanceClock(),
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.CHECKLISTS, updatedChecklist);
    await syncQueue.enqueueMutation('checklist', target.id, 'UPDATE', updatedChecklist);

    setActiveChecklist(updatedChecklist);
    if (completedCount === updatedItems.length) {
      tacticalAudio.playSyncSuccess();
    }
  };

  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    tacticalAudio.playClick();
    const parsedItems: ChecklistItem[] = rawItems
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        label: line.trim(),
        completed: false,
      }));

    const newExec: ChecklistExecution = {
      id: `chk-${Date.now()}`,
      title: newTitle,
      category: newCategory,
      status: 'In Progress',
      items: parsedItems,
      progress: { completed: 0, total: parsedItems.length },
      updatedAt: Date.now(),
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: 1,
      lamportClock: syncQueue.advanceClock(),
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.CHECKLISTS, newExec);
    await syncQueue.enqueueMutation('checklist', newExec.id, 'CREATE', newExec);

    setIsNewModalOpen(false);
    setNewTitle('');
    tacticalAudio.playSyncSuccess();
  };

  const getCategoryTagStyle = (cat: ChecklistCategory) => {
    switch (cat) {
      case 'Equipment Inspection':
        return 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/80';
      case 'Deployment Prep':
        return 'bg-amber-950/70 text-amber-400 border border-amber-800/80';
      case 'Emergency Response':
        return 'bg-[#ff5533]/20 text-[#ff5533] border border-[#ff5533]/40';
      default:
        return 'bg-cyan-950/70 text-cyan-400 border border-cyan-800/80';
    }
  };

  const formatUpdated = (time: number, device: string) => {
    const d = new Date(time);
    return `Updated ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Device ${device.replace('device-', '').toUpperCase()}`;
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
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-sans">Checklists</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Operational checks that survive every handoff and outage.
            </p>
          </div>

          <button
            onClick={() => {
              tacticalAudio.playClick();
              setIsNewModalOpen(true);
            }}
            className="px-4 py-2 rounded-md bg-[#ff5533] hover:bg-[#e64422] text-white font-semibold text-xs sm:text-sm transition flex items-center justify-center space-x-1.5 shadow-tactical-glow self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New checklist</span>
          </button>
        </div>
      </div>

      {/* Checklist Cards Grid matching screenshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {checklists.map((chk) => {
          const pct = Math.round((chk.progress.completed / chk.progress.total) * 100) || 0;
          return (
            <div
              key={chk.id}
              onClick={() => {
                tacticalAudio.playClick();
                setActiveChecklist(chk);
              }}
              className="bg-[#11161a] border border-[#232c35] hover:border-[#394754] rounded-xl p-5 flex flex-col justify-between cursor-pointer transition-all group space-y-5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[9px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded ${getCategoryTagStyle(
                      chk.category
                    )}`}
                  >
                    {chk.category.toUpperCase()}
                  </span>
                  <span className="text-slate-500 text-xs font-mono">•••</span>
                </div>

                <div className="mt-4">
                  <h3 className="text-base font-bold text-slate-100 font-sans group-hover:text-cyan-300 transition">
                    {chk.title}
                  </h3>
                  <div className="text-[10px] font-mono text-slate-400 mt-1">
                    {formatUpdated(chk.updatedAt, chk.updatedByDeviceId)}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* Progress bar and numeric counter matching screenshot */}
                <div className="space-y-1.5">
                  <div className="flex justify-end">
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {chk.progress.completed}/{chk.progress.total}
                    </span>
                  </div>
                  <div className="w-full bg-[#0d1114] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Continue checklist footer matching screenshot */}
                <div className="flex items-center space-x-1 text-xs font-mono text-slate-400 group-hover:text-slate-200 transition pt-1">
                  <span>Continue checklist</span>
                  <span>&gt;</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Checklist Runner Modal */}
      {activeChecklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="w-full max-w-xl bg-[#11161a] border border-[#232c35] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[#232c35] bg-[#161c22] flex items-center justify-between">
              <div>
                <span className={`text-[9px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded ${getCategoryTagStyle(activeChecklist.category)}`}>
                  {activeChecklist.category}
                </span>
                <h3 className="text-base font-bold text-slate-100 font-sans mt-1">{activeChecklist.title}</h3>
                <div className="text-[10px] font-mono text-slate-400">
                  {activeChecklist.progress.completed} of {activeChecklist.progress.total} steps completed
                </div>
              </div>
              <button onClick={() => setActiveChecklist(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            {/* Checklist Items list with tap-to-complete */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {activeChecklist.items.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => handleToggleItem(activeChecklist.id, item.id)}
                  className={`p-3.5 rounded-lg border transition cursor-pointer flex items-start space-x-3 select-none ${
                    item.completed
                      ? 'bg-emerald-950/20 border-emerald-800/50 text-slate-200'
                      : 'bg-[#161c22] border-[#232c35] text-slate-300 hover:border-[#394754]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${
                      item.completed ? 'bg-emerald-500 text-slate-900' : 'border border-[#394754] bg-[#0d1114]'
                    }`}
                  >
                    {item.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>

                  <div className="flex-1">
                    <div className={`text-xs font-mono ${item.completed ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                      <span className="text-slate-500 mr-2">{index + 1}.</span>
                      {item.label}
                    </div>
                    {item.completed && item.completedBy && (
                      <div className="text-[9px] font-mono text-emerald-400/80 mt-1">
                        Verified by Node {item.completedBy.replace('device-', '').toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-[#232c35] bg-[#0d1114] flex items-center justify-between">
              <div className="text-xs font-mono text-slate-400">
                Lamport Clock: <span className="text-cyan-400 font-bold">{activeChecklist.lamportClock}</span>
              </div>
              <button
                onClick={() => setActiveChecklist(null)}
                className="px-4 py-1.5 rounded bg-[#ff5533] text-white font-bold text-xs font-mono shadow-tactical-glow"
              >
                Close & Sync Delta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Checklist Creator Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#11161a] border border-[#232c35] rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#232c35] pb-3">
              <h3 className="text-base font-bold text-slate-100 font-mono">Create Tactical Checklist</h3>
              <button onClick={() => setIsNewModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateChecklist} className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Checklist Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Night Recon Protocol"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100 focus:outline-none focus:border-[#ff5533]"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100 focus:outline-none"
                >
                  <option value="Equipment Inspection">Equipment Inspection</option>
                  <option value="Deployment Prep">Deployment Prep</option>
                  <option value="Emergency Response">Emergency Response</option>
                  <option value="Medical Triage">Medical Triage</option>
                  <option value="Vehicle Check">Vehicle Check</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Checklist Steps (1 per line)</label>
                <textarea
                  rows={4}
                  required
                  value={rawItems}
                  onChange={(e) => setRawItems(e.target.value)}
                  className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#232c35]">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-[#161c22] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#ff5533] text-white font-semibold"
                >
                  Create & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
