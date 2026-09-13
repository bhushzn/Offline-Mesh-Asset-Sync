// FIELDLINK Tactical Settings & Vault Recovery View
import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  Smartphone, 
  ShieldCheck, 
  Volume2, 
  VolumeX, 
  RefreshCcw, 
  Battery, 
  Wifi, 
  Radio, 
  Edit3,
  CheckCircle2,
  X
} from 'lucide-react';
import { DeviceMetadata } from '../../types/tactical';
import { offlineStorage, STORES } from '../../services/offlineStorageService';
import { seedDatabaseIfEmpty } from '../../services/seedData';
import { batteryService, BatteryState } from '../../services/batteryService';
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
  const [isEditIdentityOpen, setIsEditIdentityOpen] = useState(false);
  const [formDeviceName, setFormDeviceName] = useState(activeDevice.deviceName);
  const [formOperatorName, setFormOperatorName] = useState(activeDevice.operatorName);
  const [formRole, setFormRole] = useState(activeDevice.role);
  const [batteryInfo, setBatteryInfo] = useState<BatteryState>(batteryService.getState());

  useEffect(() => {
    const unsub = batteryService.subscribe((status) => {
      setBatteryInfo(status);
    });
    return () => unsub();
  }, []);

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
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="text-[11px] font-mono font-semibold text-blue-700 uppercase tracking-wider">
          System Configuration · Local Vault
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Settings & System</h1>
        <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
          Device telemetry, hardware sensors, security keys, and local IndexedDB database management.
        </p>
      </div>

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Node Identity Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Local Node Identity</h3>
                <div className="text-[10px] font-mono text-slate-500">Device ID & Role</div>
              </div>
            </div>

            <button
              onClick={() => {
                tacticalAudio.playClick();
                setIsEditIdentityOpen(true);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium flex items-center space-x-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Device Name:</span>
              <span className="font-bold text-slate-900">{activeDevice.deviceName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Operator:</span>
              <span className="font-bold text-slate-900">{activeDevice.operatorName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Tactical Role:</span>
              <span className="font-bold text-blue-700">{activeDevice.role}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Hardware UUID:</span>
              <span className="font-mono text-slate-700 text-[10px] truncate max-w-[180px]">{activeDevice.deviceId}</span>
            </div>
          </div>
        </div>

        {/* Battery & Power Telemetry Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Battery className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Power & Battery Status</h3>
              <div className="text-[10px] font-mono text-slate-500">Battery Status API Monitor</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">Charge Level:</span>
              <span className="text-base font-bold font-mono text-slate-900">{Math.round(batteryInfo.level)}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  batteryInfo.level > 40 ? 'bg-emerald-500' : batteryInfo.level > 20 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, Math.round(batteryInfo.level)))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-1">
              <span>Status: {batteryInfo.charging ? 'Charging' : 'Discharging'}</span>
              <span className={batteryInfo.isLowPowerMode ? 'text-amber-700 font-semibold' : 'text-emerald-700'}>
                {batteryInfo.isLowPowerMode ? 'Low-Power Throttled' : 'Full Power Mesh'}
              </span>
            </div>
          </div>
        </div>

        {/* Tactical Audio & Alerts Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Tactical Audio Cues</h3>
              <div className="text-[10px] font-mono text-slate-500">Synthetic Web Audio Synthesizer</div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-700">Sound Effects:</span>
            <button
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) tacticalAudio.playClick();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition touch-target-min ${
                soundEnabled
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {soundEnabled ? 'Enabled' : 'Muted'}
            </button>
          </div>
        </div>

        {/* Security & Cryptographic Vault Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Security & Encryption</h3>
              <div className="text-[10px] font-mono text-slate-500">Web Crypto API</div>
            </div>
          </div>

          <div className="space-y-2 text-xs font-mono text-slate-600">
            <div className="flex justify-between">
              <span>Cipher:</span>
              <span className="font-bold text-slate-900">AES-GCM 256-bit</span>
            </div>
            <div className="flex justify-between">
              <span>Integrity:</span>
              <span className="font-bold text-slate-900">SHA-256 Hashes</span>
            </div>
            <div className="flex justify-between">
              <span>Clock Synced:</span>
              <span className="font-bold text-emerald-700">Hybrid Logical Clocks (HLC)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Vault Backup & Maintenance Strip */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-base">Vault Database Backup & Recovery</h3>
        <p className="text-xs text-slate-600">
          Export full offline state (Assets, Personnel, Incidents, Checklists, Audit Logs) to an encrypted JSON backup or restore a previous snapshot.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExportSnapshot}
            className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center space-x-2 shadow-xs touch-target-min"
          >
            <Download className="w-4 h-4" />
            <span>Export Vault JSON</span>
          </button>

          <label className="px-4 py-2.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition flex items-center space-x-2 cursor-pointer shadow-xs touch-target-min">
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Import Snapshot</span>
            <input type="file" accept=".json" onChange={handleImportSnapshot} className="hidden" />
          </label>

          <button
            onClick={handleResetDatabase}
            className="px-4 py-2.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition flex items-center space-x-2 shadow-xs touch-target-min"
          >
            <RefreshCcw className="w-4 h-4" />
            <span>Factory Reset Database</span>
          </button>
        </div>
      </div>

      {/* Edit Identity Modal */}
      {isEditIdentityOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">Edit Node Identity</h3>
              <button
                onClick={() => setIsEditIdentityOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIdentity} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Device Name</label>
                <input
                  type="text"
                  required
                  value={formDeviceName}
                  onChange={(e) => setFormDeviceName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Operator Name</label>
                <input
                  type="text"
                  required
                  value={formOperatorName}
                  onChange={(e) => setFormOperatorName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tactical Role</label>
                <input
                  type="text"
                  required
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditIdentityOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:text-slate-800 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
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
