// FIELDLINK Tactical Header
import React from 'react';
import { 
  Menu, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  FlaskConical, 
  Radio, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { DeviceMetadata, SyncStats } from '../../types/tactical';
import { tacticalAudio } from '../../utils/audio';

interface HeaderProps {
  breadcrumb: string;
  activeDevice: DeviceMetadata;
  syncStats: SyncStats;
  onOpenMobileMenu: () => void;
  onOpenTestSuite: () => void;
  onManualSync: () => void;
  isOnline: boolean;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  breadcrumb,
  activeDevice,
  syncStats,
  onOpenMobileMenu,
  onOpenTestSuite,
  onManualSync,
  isOnline,
  soundEnabled,
  setSoundEnabled,
}) => {
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    tacticalAudio.setSoundEnabled(next);
    if (next) tacticalAudio.playClick();
  };

  return (
    <header className="h-16 border-b border-[#232c35] bg-[#0a0d0f]/90 backdrop-blur-md sticky top-0 z-20 px-4 md:px-6 flex items-center justify-between">
      {/* Left: Mobile Menu & Breadcrumb */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-[#161c22] md:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
            Field Operations / {breadcrumb}
          </div>
          <h1 className="text-base md:text-lg font-bold text-slate-100 font-sans capitalize">
            {breadcrumb}
          </h1>
        </div>
      </div>

      {/* Right: Telemetry & Actions */}
      <div className="flex items-center space-x-2 md:space-x-3 font-mono text-xs">
        {/* Connection Status Pill */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#11161a] border border-[#232c35]">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className={`text-[11px] font-medium uppercase tracking-wider ${
            isOnline ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        {/* Device Identifier */}
        <div className="hidden md:flex items-center space-x-1.5 text-slate-400 px-2 py-1 bg-[#11161a] border border-[#232c35] rounded">
          <span className="w-1.5 h-1.5 rounded-full bg-[#ff5533]"></span>
          <span className="text-[11px] text-slate-300">Device {activeDevice.deviceId.replace('device-', '').toUpperCase()}</span>
        </div>

        {/* Pending Sync Badge */}
        <div className={`flex items-center space-x-1 px-2.5 py-1 rounded border transition-all ${
          syncStats.pendingCount > 0 
            ? 'bg-amber-950/40 border-amber-800/80 text-amber-300 shadow-sm'
            : 'bg-[#11161a] border-[#232c35] text-slate-400'
        }`}>
          {syncStats.pendingCount > 0 ? (
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
          )}
          <span className="font-semibold text-[11px]">{syncStats.pendingCount} pending</span>
        </div>

        {/* Test Suite Button */}
        <button
          onClick={() => {
            tacticalAudio.playClick();
            onOpenTestSuite();
          }}
          className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-[#161c22] border border-[#232c35] text-cyan-400 hover:bg-cyan-950/40 hover:border-cyan-800 transition"
          title="Run In-App Verification Test Suite"
        >
          <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[11px]">CRDT Tests</span>
        </button>

        {/* Quick Sync Button */}
        <button
          onClick={() => {
            tacticalAudio.playClick();
            onManualSync();
          }}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#ff5533]/15 border border-[#ff5533]/40 text-[#ff5533] hover:bg-[#ff5533]/25 transition font-semibold"
          title="Trigger P2P Mesh Sync"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px]">Sync Mesh</span>
        </button>

        {/* Audio Toggle */}
        <button
          onClick={toggleSound}
          className="p-1.5 rounded bg-[#11161a] border border-[#232c35] text-slate-400 hover:text-slate-200 transition"
          title={soundEnabled ? 'Disable tactical audio' : 'Enable tactical audio'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
        </button>
      </div>
    </header>
  );
};
