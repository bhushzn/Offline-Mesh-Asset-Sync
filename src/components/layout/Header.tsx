// FIELDLINK Operational Header (Light Professional Theme)
import React, { useEffect, useState } from 'react';
import { 
  Menu, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  FlaskConical, 
  Radio, 
  CheckCircle2, 
  AlertCircle,
  Battery,
  BatteryCharging,
  Cpu
} from 'lucide-react';
import { DeviceMetadata, OperatingMode, SyncStats } from '../../types/tactical';
import { tacticalAudio } from '../../utils/audio';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { batteryService, BatteryState } from '../../services/batteryService';

interface HeaderProps {
  breadcrumb: string;
  activeDevice: DeviceMetadata;
  syncStats: SyncStats;
  mode: OperatingMode;
  onToggleMode: (mode: OperatingMode) => void;
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
  mode,
  onToggleMode,
  onOpenMobileMenu,
  onOpenTestSuite,
  onManualSync,
  isOnline,
  soundEnabled,
  setSoundEnabled,
}) => {
  const [battery, setBattery] = useState<BatteryState>(batteryService.getState());

  useEffect(() => {
    return batteryService.subscribe(setBattery);
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    tacticalAudio.setSoundEnabled(next);
    if (next) tacticalAudio.playClick();
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-20 px-4 md:px-6 flex items-center justify-between shadow-xs">
      {/* Left: Mobile Menu & Breadcrumb */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 md:hidden touch-target-min"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-medium">
            FIELDLINK Ops / {breadcrumb}
          </div>
          <h1 className="text-base md:text-lg font-bold text-slate-900 font-sans capitalize tracking-tight">
            {breadcrumb}
          </h1>
        </div>
      </div>

      {/* Right: Telemetry & Actions */}
      <div className="flex items-center space-x-2 md:space-x-3 font-mono text-xs">
        {/* Mode Switcher Pill */}
        <button
          onClick={() => onToggleMode(mode === 'FIELD_MODE' ? 'DEMO_MODE' : 'FIELD_MODE')}
          title={mode === 'FIELD_MODE' ? 'Operating in Live Field Mode' : 'Operating in Simulated Demo Mode'}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border transition-all ${
            mode === 'FIELD_MODE'
              ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
              : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{mode === 'FIELD_MODE' ? 'FIELD MODE' : 'DEMO SIMULATION'}</span>
          <span className="sm:hidden">{mode === 'FIELD_MODE' ? 'FIELD' : 'DEMO'}</span>
        </button>

        {/* Battery Indicator */}
        <div 
          className={`hidden lg:flex items-center space-x-1 px-2 py-1 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-mono ${
            battery.isLowPowerMode ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold animate-pulse' : ''
          }`}
          title={battery.isLowPowerMode ? 'Low power mode active: throttled background mesh' : 'Battery status'}
        >
          {battery.charging ? <BatteryCharging className="w-3.5 h-3.5 text-emerald-600" /> : <Battery className="w-3.5 h-3.5 text-slate-600" />}
          <span>{battery.level}%</span>
        </div>

        {/* Connection Status Pill */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${
            isOnline ? 'text-emerald-700' : 'text-amber-700'
          }`}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        {/* Pending Sync Badge */}
        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border transition-all ${
          syncStats.pendingCount > 0 
            ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-xs font-semibold'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}>
          {syncStats.pendingCount > 0 ? (
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 animate-bounce" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          )}
          <span className="text-[11px]">{syncStats.pendingCount} pending</span>
        </div>

        {/* Test Suite Button */}
        <button
          onClick={() => {
            tacticalAudio.playClick();
            onOpenTestSuite();
          }}
          className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition"
          title="Run Verification Tests"
        >
          <FlaskConical className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-[11px] font-medium">Verify CRDT</span>
        </button>

        {/* Quick Sync Button */}
        <button
          onClick={() => {
            tacticalAudio.playClick();
            onManualSync();
          }}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition font-semibold"
          title="Trigger P2P Mesh Sync"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-[11px]">Sync Now</span>
        </button>

        {/* PWA Install Button */}
        <PWAInstallButton />

        {/* Audio Toggle */}
        <button
          onClick={toggleSound}
          className="p-2 rounded-md bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 transition"
          title={soundEnabled ? 'Disable audio' : 'Enable audio'}
          aria-label="Toggle sound"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-slate-700" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
        </button>
      </div>
    </header>
  );
};

