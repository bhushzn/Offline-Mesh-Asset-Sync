// FIELDLINK Tactical Settings & Vault Recovery View
import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  Smartphone, 
  ShieldCheck, 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  RefreshCcw, 
  Radio, 
  Lock, 
  ChevronRight, 
  Edit3 
} from 'lucide-react';
import { DeviceMetadata } from '../../types/tactical';
import { offlineStorage, STORES } from '../../services/offlineStorageService';
import { seedDatabaseIfEmpty } from '../../services/seedData';
import { tacticalAudio } from '../../utils/audio';

interface Props {
  activeDevice: DeviceMetadata;
  setActiveDevice: (device: DeviceMetadata) => void;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

export const SettingsView: React.FC<Props> = ({
  activeDevice,
  setActiveDevice,
  isOnline,
  setIsOnline,
  soundEnabled,
  setSoundEnabled,
}) => {
  const [rolePermissionsEnabled, setRolePermissionsEnabled] = useState(true);
  const [isEditIdentityOpen, setIsEditIdentityOpen] = useState(false);
  const [formDeviceName, setFormDeviceName] = useState(activeDevice.deviceName);
  const [formOperatorName, setFormOperatorName] = useState(activeDevice.operatorName);
  const [formRole, setFormRole] = useState(activeDevice.role);

  const handleExportSnapshot = async () => {
    tacticalAudio.playClick();
    const snapshot = await offlineStorage.exportSnapshot();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(snapshot, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `fieldlink_vault_${activeDevice.deviceId}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    tacticalAudio.playSyncSuccess();
  };

  const handleImportSnapshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          await offlineStorage.importSnapshot(parsed);
          tacticalAudio.playSyncSuccess();
          alert('Snapshot successfully restored into local IndexedDB!');
        } catch {
          alert('Failed to parse snapshot JSON.');
        }
      };
    }
  };

  const handleResetDatabase = async () => {
    if (confirm('Reset local IndexedDB store and reload standard tactical operations demo data?')) {
      tacticalAudio.playClick();
      await offlineStorage.clearAll();
      await seedDatabaseIfEmpty();
      window.location.reload();
    }
  };

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    tacticalAudio.playClick();
    const updated: DeviceMetadata = {
      ...activeDevice,
      deviceName: formDeviceName,
      operatorName: formOperatorName,
      role: formRole,
    };
    await offlineStorage.put(STORES.DEVICE_METADATA, updated);
    setActiveDevice(updated);
    setIsEditIdentityOpen(false);
    tacticalAudio.playSyncSuccess();
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Context */}
      <div>
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
          Device Configuration / {activeDevice.deviceId.replace('device-', '').toUpperCase()}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 font-sans">Settings</h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Control local behavior, recovery and field identity.
            </p>
          </div>
        </div>
      </div>

      {/* Two Columns Grid matching screenshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recovery & data */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider">
            Recovery & data
          </h3>

          <div className="bg-[#11161a] border border-[#232c35] rounded-xl overflow-hidden divide-y divide-[#232c35]">
            {/* Export local snapshot matching screenshot */}
            <div
              onClick={handleExportSnapshot}
              className="p-4 flex items-center justify-between hover:bg-[#161c22] cursor-pointer transition group"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-8 h-8 rounded bg-[#ff5533]/15 text-[#ff5533] flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100 font-mono group-hover:text-[#ff5533] transition">
                    Export local snapshot
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Portable encrypted recovery file
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#ff5533]" />
            </div>

            {/* Import snapshot matching screenshot */}
            <label className="p-4 flex items-center justify-between hover:bg-[#161c22] cursor-pointer transition group block">
              <div className="flex items-center space-x-3.5">
                <div className="w-8 h-8 rounded bg-cyan-950/60 text-cyan-400 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100 font-mono group-hover:text-cyan-300 transition">
                    Import snapshot
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Restore records from another device
                  </div>
                </div>
              </div>
              <input type="file" accept=".json" onChange={handleImportSnapshot} className="hidden" />
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </label>

            {/* Reset Database */}
            <div
              onClick={handleResetDatabase}
              className="p-4 flex items-center justify-between hover:bg-[#161c22] cursor-pointer transition group"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-8 h-8 rounded bg-amber-950/60 text-amber-400 flex items-center justify-center">
                  <RefreshCcw className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100 font-mono group-hover:text-amber-300 transition">
                    Reset local database
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Re-initialize demo dataset in IndexedDB
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Right Column: Device identity matching screenshot */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider">
              Device identity
            </h3>
            <button
              onClick={() => {
                tacticalAudio.playClick();
                setIsEditIdentityOpen(true);
              }}
              className="text-xs font-mono text-slate-400 hover:text-slate-200"
            >
              Edit &gt;
            </button>
          </div>

          <div className="bg-[#11161a] border border-[#232c35] rounded-xl p-5 space-y-4">
            {/* Device ID Card matching screenshot */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3.5">
                <div className="w-9 h-9 rounded bg-[#161c22] border border-[#232c35] flex items-center justify-center text-[#ff5533]">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-100 font-mono">{activeDevice.deviceName}</div>
                  <div className="text-xs text-slate-400 font-mono">Operator: {activeDevice.operatorName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">Role: {activeDevice.role}</div>
                </div>
              </div>

              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-950/70 text-emerald-400 border border-emerald-800">
                TRUSTED
              </span>
            </div>

            {/* Role-based permissions toggle matching screenshot */}
            <div className="pt-4 border-t border-[#232c35] flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-4 h-4 text-[#ff5533]" />
                <div>
                  <div className="text-xs font-bold text-slate-200 font-mono">Role-based permissions</div>
                  <div className="text-[11px] text-slate-400 font-sans">Field lead · full local access</div>
                </div>
              </div>

              <button
                onClick={() => {
                  tacticalAudio.playClick();
                  setRolePermissionsEnabled(!rolePermissionsEnabled);
                }}
                className={`w-11 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                  rolePermissionsEnabled ? 'bg-emerald-500' : 'bg-[#232c35]'
                }`}
              >
                <div
                  className={`bg-slate-900 w-4 h-4 rounded-full shadow-md transform transition duration-300 ${
                    rolePermissionsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Network Simulator Controls */}
          <div className="bg-[#11161a] border border-[#232c35] rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
              Tactical Network Isolation Simulator
            </h4>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  tacticalAudio.playClick();
                  setIsOnline(true);
                }}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition flex items-center space-x-1.5 ${
                  isOnline
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700'
                    : 'bg-[#161c22] text-slate-400 border border-[#232c35]'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Simulate Online (Gateway Link)</span>
              </button>
              <button
                onClick={() => {
                  tacticalAudio.playClick();
                  setIsOnline(false);
                }}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition flex items-center space-x-1.5 ${
                  !isOnline
                    ? 'bg-amber-950/80 text-amber-300 border border-amber-700'
                    : 'bg-[#161c22] text-slate-400 border border-[#232c35]'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Simulate Zero-Bandwidth Offline</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Identity Modal */}
      {isEditIdentityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#11161a] border border-[#232c35] rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#232c35] pb-3">
              <h3 className="text-base font-bold text-slate-100 font-mono">Edit Device Identity</h3>
              <button onClick={() => setIsEditIdentityOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveIdentity} className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Device Node Name</label>
                <input
                  type="text"
                  required
                  value={formDeviceName}
                  onChange={(e) => setFormDeviceName(e.target.value)}
                  className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Operator Name</label>
                <input
                  type="text"
                  required
                  value={formOperatorName}
                  onChange={(e) => setFormOperatorName(e.target.value)}
                  className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Assigned Tactical Role</label>
                <input
                  type="text"
                  required
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full bg-[#161c22] border border-[#232c35] rounded p-2 text-slate-100"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#232c35]">
                <button
                  type="button"
                  onClick={() => setIsEditIdentityOpen(false)}
                  className="px-3 py-1.5 rounded bg-[#161c22] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#ff5533] text-white font-semibold"
                >
                  Save Identity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
