// FIELDLINK Tactical Assets Management View
import React, { useEffect, useState } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Tag, 
  MapPin, 
  UserCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  QrCode,
  SlidersHorizontal,
  X,
  Smartphone,
  ShieldCheck,
  Check
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
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState('');

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
      asset.assignment.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.sector.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory === 'ALL' || asset.category === selectedCategory;
    const matchStatus = selectedStatus === 'ALL' || asset.status === selectedStatus;
    return matchSearch && matchCategory && matchStatus;
  });

  const totalCount = assets.length;
  const availableCount = assets.filter((a) => a.status === 'Available').length;
  const deployedCount = assets.filter((a) => a.status === 'Deployed').length;
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
      lamportClock: syncQueue.advanceClock().lamport,
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
      lamportClock: syncQueue.advanceClock().lamport,
      syncStatus: 'pending',
    };

    await offlineStorage.put(STORES.ASSETS, updated);
    await syncQueue.enqueueMutation('asset', asset.id, 'UPDATE', updated);
    setSelectedAsset(null);
  };

  const handleSimulateQrScan = (code: string) => {
    tacticalAudio.playClick();
    setScannedCode(code);
    const found = assets.find((a) => a.customId.toLowerCase() === code.toLowerCase() || a.serialNumber?.toLowerCase() === code.toLowerCase());
    if (found) {
      setSelectedAsset(found);
      setIsQrScannerOpen(false);
    }
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
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono font-semibold text-blue-700 uppercase tracking-wider">
            IndexedDB Local Store · CRDT Versioned
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Tactical Assets</h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
            Equipment accountability and muster across operational sectors.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              tacticalAudio.playClick();
              setIsQrScannerOpen(true);
            }}
            className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 font-medium text-xs sm:text-sm transition flex items-center space-x-2 shadow-xs touch-target-min"
          >
            <QrCode className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Scan Tag</span>
          </button>

          <button
            onClick={() => {
              tacticalAudio.playClick();
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm transition flex items-center space-x-1.5 shadow-xs touch-target-min"
          >
            <Plus className="w-4 h-4" />
            <span>Add Asset</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-slate-500">Total Assets</div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{totalCount}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-emerald-700">Available</div>
          <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">{availableCount}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-blue-700">Deployed</div>
          <div className="text-xl font-bold text-blue-700 mt-1 font-mono">{deployedCount}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[10px] uppercase font-mono font-semibold text-amber-700">Attention Required</div>
          <div className="text-xl font-bold text-amber-700 mt-1 font-mono">{attentionCount}</div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID, name, sector, or operator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans shadow-xs"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 sm:flex-none bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm rounded-lg px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
          >
            <option value="ALL">All Categories</option>
            <option value="Medical">Medical</option>
            <option value="Comms">Comms</option>
            <option value="Mobility">Mobility</option>
            <option value="Power">Power</option>
            <option value="Tactical Gear">Tactical Gear</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="flex-1 sm:flex-none bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm rounded-lg px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Deployed">Deployed</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Offline">Offline</option>
          </select>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono">
            <tr>
              <th className="py-3 px-4 uppercase font-semibold text-[10px]">Asset ID & Name</th>
              <th className="py-3 px-4 uppercase font-semibold text-[10px]">Category</th>
              <th className="py-3 px-4 uppercase font-semibold text-[10px]">Condition</th>
              <th className="py-3 px-4 uppercase font-semibold text-[10px]">Assignment / Sector</th>
              <th className="py-3 px-4 uppercase font-semibold text-[10px]">Status</th>
              <th className="py-3 px-4 uppercase font-semibold text-[10px]">Last Modified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAssets.map((asset) => (
              <tr
                key={asset.id}
                onClick={() => {
                  tacticalAudio.playClick();
                  setSelectedAsset(asset);
                }}
                className="hover:bg-slate-50/80 cursor-pointer transition-colors"
              >
                <td className="py-3.5 px-4">
                  <div className="font-mono font-bold text-slate-900 text-xs">{asset.customId}</div>
                  <div className="text-slate-600 text-[11px] font-sans">{asset.name}</div>
                </td>
                <td className="py-3.5 px-4 text-slate-600">{asset.category}</td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                      asset.condition === 'Good' || asset.condition === 'Operational'
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                        : asset.condition === 'Degraded'
                        ? 'text-amber-700 bg-amber-50 border border-amber-200'
                        : 'text-rose-700 bg-rose-50 border border-rose-200'
                    }`}
                  >
                    {asset.condition}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-slate-600">
                  <div className="font-medium text-slate-900">{asset.assignment}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{asset.sector}</div>
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase font-mono ${
                      asset.status === 'Deployed'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : asset.status === 'Available'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {asset.status}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-[11px] text-slate-500 font-mono">
                  {formatTime(asset.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAssets.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-xs font-mono">
            No assets found matching the query.
          </div>
        )}
      </div>

      {/* Mobile Card View (Optimized with 44px touch targets) */}
      <div className="md:hidden space-y-3">
        {filteredAssets.map((asset) => (
          <div
            key={asset.id}
            onClick={() => {
              tacticalAudio.playClick();
              setSelectedAsset(asset);
            }}
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 active:bg-slate-50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono font-bold text-slate-900 text-sm">{asset.customId}</div>
                <div className="font-sans font-medium text-slate-700 text-xs">{asset.name}</div>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold font-mono uppercase ${
                  asset.status === 'Deployed'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : asset.status === 'Available'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {asset.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Category</span>
                <span className="font-medium text-slate-800">{asset.category}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-mono text-slate-400 block">Assignment</span>
                <span className="font-medium text-slate-800 truncate block">{asset.assignment}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
              <span>{asset.sector}</span>
              <span>v{asset.version} · {formatTime(asset.updatedAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Action Modal (Update Asset Status / Assignment) */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="text-[10px] font-mono uppercase font-semibold text-blue-700">Quick Edit Asset</div>
                <div className="font-bold text-slate-900 text-base">{selectedAsset.customId} · {selectedAsset.name}</div>
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Change Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Available', 'Deployed', 'Maintenance'] as AssetStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleUpdateStatus(selectedAsset, st, selectedAsset.assignment)}
                      className={`py-2.5 px-3 rounded-lg text-xs font-medium border touch-target-min transition ${
                        selectedAsset.status === st
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Personnel / Unit</label>
                <input
                  type="text"
                  defaultValue={selectedAsset.assignment}
                  onBlur={(e) => {
                    if (e.target.value !== selectedAsset.assignment) {
                      handleUpdateStatus(selectedAsset, selectedAsset.status, e.target.value);
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-sans"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Sector:</span>
                  <span className="font-semibold text-slate-800">{selectedAsset.sector}</span>
                </div>
                <div className="flex justify-between">
                  <span>Lamport Clock:</span>
                  <span className="font-semibold text-slate-800">{selectedAsset.lamportClock}</span>
                </div>
                <div className="flex justify-between">
                  <span>CRDT Version:</span>
                  <span className="font-semibold text-slate-800">v{selectedAsset.version}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedAsset(null)}
              className="w-full py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition touch-target-min"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add New Asset Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="text-[10px] font-mono uppercase font-semibold text-blue-700">New Item Entry</div>
                <h2 className="font-bold text-slate-900 text-lg">Add Tactical Asset</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Asset ID (Barcode/Custom)</label>
                  <input
                    type="text"
                    required
                    placeholder="MED-701"
                    value={formCustomId}
                    onChange={(e) => setFormCustomId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Asset Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Field Trauma Kit"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as AssetCategory)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Medical">Medical</option>
                    <option value="Comms">Comms</option>
                    <option value="Mobility">Mobility</option>
                    <option value="Power">Power</option>
                    <option value="Tactical Gear">Tactical Gear</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Condition</label>
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value as AssetCondition)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Good">Good</option>
                    <option value="Operational">Operational</option>
                    <option value="Degraded">Degraded</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as AssetStatus)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="Available">Available</option>
                    <option value="Deployed">Deployed</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assignment</label>
                  <input
                    type="text"
                    placeholder="Alpha Fireteam"
                    value={formAssignment}
                    onChange={(e) => setFormAssignment(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sector</label>
                  <input
                    type="text"
                    placeholder="Base Alpha"
                    value={formSector}
                    onChange={(e) => setFormSector(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Operational Notes</label>
                <textarea
                  rows={2}
                  placeholder="Battery charged to 100%, inspected."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
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
                  Commit Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR/Barcode Scanner Simulation Modal */}
      {isQrScannerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Scan Tactical QR Tag</h3>
              </div>
              <button
                onClick={() => setIsQrScannerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900 rounded-xl p-8 text-center text-white space-y-3 relative overflow-hidden">
              <div className="w-32 h-32 mx-auto border-2 border-dashed border-blue-400 rounded-xl flex items-center justify-center relative">
                <div className="w-full h-0.5 bg-blue-400 absolute top-1/2 -translate-y-1/2 shadow-[0_0_12px_#38bdf8] animate-pulse" />
                <QrCode className="w-16 h-16 text-slate-400/40" />
              </div>
              <div className="text-xs font-mono text-slate-300">Align camera with asset QR / Barcode</div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-600">Quick Test Tags:</div>
              <div className="grid grid-cols-2 gap-2">
                {['MED-701', 'COM-402', 'VEH-012', 'PWR-881'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleSimulateQrScan(tag)}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-300 text-xs font-mono font-semibold text-slate-700 hover:text-blue-700 transition"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsQrScannerOpen(false)}
              className="w-full py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
