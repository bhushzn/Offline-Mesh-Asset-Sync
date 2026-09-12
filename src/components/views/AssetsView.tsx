// FIELDLINK Tactical Assets Management View
import React, { useEffect, useState } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Filter, 
  Tag, 
  MapPin, 
  UserCheck, 
  Clock, 
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Send
} from 'lucide-react';
import { Asset, AssetCategory, AssetCondition, AssetStatus } from '../../types/tactical';
import { offlineStorage, STORES } from '../../services/offlineStorageService';
import { syncQueue } from '../../services/syncQueueService';
import { tacticalAudio } from '../../utils/audio';

export const AssetsView: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // New Asset form state
  const [formCustomId, setFormCustomId] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<AssetCategory>('Medical');
  const [formCondition, setFormCondition] = useState<AssetCondition>('Good');
  const [formStatus, setFormStatus] = useState<AssetStatus>('Available');
  const [formAssignment, setFormAssignment] = useState('Unassigned');
  const [formSector, setFormSector] = useState('Base Alpha');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    loadAssets();
    const unsub = offlineStorage.subscribe((store) => {
      if (store === STORES.ASSETS) loadAssets();
    });
    return () => unsub();
  }, []);

  const loadAssets = async () => {
    const list = await offlineStorage.getAll<Asset>(STORES.ASSETS);
    setAssets(list);
  };

  const filteredAssets = assets.filter((asset) => {
    const matchSearch =
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.customId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.assignment.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory === 'ALL' || asset.category === selectedCategory;
    const matchStatus = selectedStatus === 'ALL' || asset.status === selectedStatus;
    return matchSearch && matchCategory && matchStatus;
  });

  const totalCount = assets.length;
  const availableCount = assets.filter((a) => a.status === 'Available').length;
  const attentionCount = assets.filter((a) => a.condition === 'Degraded' || a.condition === 'Critical').length;

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomId || !formName) return;

    tacticalAudio.playClick();

    const newAsset: Asset = {
      id: `asset-${Date.now()}`,
      customId: formCustomId.toUpperCase(),
      name: formName,
      category: formCategory,
      condition: formCondition,
      status: formStatus,
      assignment: formAssignment,
      sector: formSector,
      serialNumber: `SN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      notes: formNotes,
      updatedAt: Date.now(),
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: 1,
      lamportClock: syncQueue.advanceClock(),
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.ASSETS, newAsset);
    await syncQueue.enqueueMutation('asset', newAsset.id, 'CREATE', newAsset);

    setIsAddModalOpen(false);
    resetForm();
    tacticalAudio.playSyncSuccess();
  };

  const handleUpdateStatus = async (asset: Asset, newStatus: AssetStatus, newAssignment: string) => {
    tacticalAudio.playClick();
    const updated: Asset = {
      ...asset,
      status: newStatus,
      assignment: newAssignment,
      updatedAt: Date.now(),
      updatedByDeviceId: syncQueue.getDeviceId(),
      version: asset.version + 1,
      lamportClock: syncQueue.advanceClock(),
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.ASSETS, updated);
    await syncQueue.enqueueMutation('asset', asset.id, 'UPDATE', updated);
    setSelectedAsset(null);
  };

  const resetForm = () => {
    setFormCustomId('');
    setFormName('');
    setFormCategory('Medical');
    setFormCondition('Good');
    setFormStatus('Available');
    setFormAssignment('Unassigned');
    setFormSector('Base Alpha');
    setFormNotes('');
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb Context */}
      <div>
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          Local Data Store / IndexedDB
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-sans">Assets</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Equipment accountability across your operational area.
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
            <span>Add asset</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar matching screenshot */}
      <div className="flex flex-wrap items-center space-x-3 text-xs font-mono">
        <span className="text-slate-200 font-bold">{totalCount} total assets</span>
        <span className="text-slate-600">•</span>
        <span className="text-emerald-400">{availableCount} available</span>
        <span className="text-slate-600">•</span>
        <span className="text-[#ff5533]">{attentionCount} attention required</span>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search records"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#11161a] border border-[#232c35] rounded-md pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#11161a] border border-[#232c35] text-slate-300 text-xs rounded-md px-3 py-2 font-mono focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="Medical">Medical</option>
            <option value="Comms">Comms</option>
            <option value="Mobility">Mobility</option>
            <option value="Power">Power</option>
            <option value="Tactical Gear">Tactical Gear</option>
          </select>
        </div>
      </div>

      {/* Table matching screenshot */}
      <div className="bg-[#11161a] border border-[#232c35] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0d1114] border-b border-[#232c35] text-slate-400">
              <tr>
                <th className="py-3 px-4 uppercase font-semibold text-[10px]">Asset</th>
                <th className="py-3 px-4 uppercase font-semibold text-[10px]">Category</th>
                <th className="py-3 px-4 uppercase font-semibold text-[10px]">Condition</th>
                <th className="py-3 px-4 uppercase font-semibold text-[10px]">Assignment</th>
                <th className="py-3 px-4 uppercase font-semibold text-[10px]">Status</th>
                <th className="py-3 px-4 uppercase font-semibold text-[10px]">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#232c35]">
              {filteredAssets.map((asset) => (
                <tr
                  key={asset.id}
                  onClick={() => {
                    tacticalAudio.playClick();
                    setSelectedAsset(asset);
                  }}
                  className="hover:bg-[#161c22] cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-100">{asset.customId}</div>
                    <div className="text-slate-400 text-[11px] font-sans">{asset.name}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{asset.category}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                        asset.condition === 'Good' || asset.condition === 'Operational'
                          ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/60'
                          : asset.condition === 'Degraded'
                          ? 'text-amber-400 bg-amber-950/40 border border-amber-800/60'
                          : 'text-rose-400 bg-rose-950/40 border border-rose-800/60'
                      }`}
                    >
                      {asset.condition}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{asset.assignment}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase ${
                        asset.status === 'Deployed'
                          ? 'bg-blue-950/70 text-blue-400 border border-blue-800'
                          : asset.status === 'Available'
                          ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950/70 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {asset.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">{formatTime(asset.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Asset Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#11161a] border border-[#232c35] rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#232c35] pb-3">
              <h3 className="text-base font-bold text-slate-100 font-mono flex items-center space-x-2">
                <Package className="w-4 h-4 text-[#ff5533]" />
                <span>Register Tactical Asset</span>
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateAsset} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Asset ID (e.g. MK-205)</label>
                  <input
                    type="text"
                    required
                    placeholder="MK-205"
                    value={formCustomId}
                    onChange={(e) => setFormCustomId(e.target.value)}
                    className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100 focus:outline-none focus:border-[#ff5533]"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100 focus:outline-none"
                  >
                    <option value="Medical">Medical</option>
                    <option value="Comms">Comms</option>
                    <option value="Mobility">Mobility</option>
                    <option value="Power">Power</option>
                    <option value="Tactical Gear">Tactical Gear</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Asset Name / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Trauma response kit"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100 focus:outline-none focus:border-[#ff5533]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Condition</label>
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value as any)}
                    className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                  >
                    <option value="Good">Good</option>
                    <option value="Operational">Operational</option>
                    <option value="Degraded">Degraded</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Initial Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                  >
                    <option value="Available">Available</option>
                    <option value="Deployed">Deployed</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Assignment / Squad</label>
                  <input
                    type="text"
                    value={formAssignment}
                    onChange={(e) => setFormAssignment(e.target.value)}
                    className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Sector Location</label>
                  <input
                    type="text"
                    value={formSector}
                    onChange={(e) => setFormSector(e.target.value)}
                    className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Operational Notes</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Tactical details, expiry, or checklist links"
                  className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#232c35]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded bg-[#161c22] border border-[#232c35] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#ff5533] text-white font-semibold shadow-tactical-glow"
                >
                  Save & Enqueue Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asset Detail / Deployment Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#11161a] border border-[#232c35] rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#232c35] pb-3">
              <div>
                <div className="text-xs font-mono text-[#ff5533] font-bold">{selectedAsset.customId}</div>
                <h3 className="text-base font-bold text-slate-100 font-sans">{selectedAsset.name}</h3>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between p-2 rounded bg-[#161c22]">
                <span className="text-slate-400">Category:</span>
                <span className="text-slate-200">{selectedAsset.category}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-[#161c22]">
                <span className="text-slate-400">Condition:</span>
                <span className="text-emerald-400 font-semibold">{selectedAsset.condition}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-[#161c22]">
                <span className="text-slate-400">Assignment:</span>
                <span className="text-slate-200">{selectedAsset.assignment}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-[#161c22]">
                <span className="text-slate-400">Sector:</span>
                <span className="text-slate-200">{selectedAsset.sector}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-[#161c22]">
                <span className="text-slate-400">CRDT Lamport Clock:</span>
                <span className="text-cyan-400 font-bold">{selectedAsset.lamportClock}</span>
              </div>
              <p className="text-slate-400 font-sans text-xs p-2">{selectedAsset.notes}</p>
            </div>

            <div className="border-t border-[#232c35] pt-3 space-y-2">
              <div className="text-[11px] font-mono text-slate-400 uppercase">Change Deployment State:</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleUpdateStatus(selectedAsset, 'Deployed', 'South sector')}
                  className="p-2 rounded bg-blue-950/60 border border-blue-800 text-blue-300 text-xs font-mono font-bold hover:bg-blue-900/60"
                >
                  Deploy to Field
                </button>
                <button
                  onClick={() => handleUpdateStatus(selectedAsset, 'Available', 'Armoury')}
                  className="p-2 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-mono font-bold hover:bg-emerald-900/60"
                >
                  Check-in / Available
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
