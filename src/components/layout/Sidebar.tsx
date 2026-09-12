import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  CheckSquare, 
  AlertTriangle, 
  Share2, 
  Settings, 
  ShieldCheck, 
  Smartphone,
  Layers,
  Map
} from 'lucide-react';
import { DeviceMetadata } from '../../types/tactical';
import { tacticalAudio } from '../../utils/audio';

export type ActiveTab = 'dashboard' | 'assets' | 'personnel' | 'checklists' | 'incidents' | 'map' | 'sync' | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeDevice: DeviceMetadata;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeDevice,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assets', label: 'Assets', icon: Package },
    { id: 'personnel', label: 'Personnel / Roll Call', icon: Users },
    { id: 'checklists', label: 'Checklists', icon: CheckSquare },
    { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
    { id: 'map', label: 'Tactical Map / GIS', icon: Map },
    { id: 'sync', label: 'Sync Center', icon: Share2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  const handleNav = (id: ActiveTab) => {
    tacticalAudio.playClick();
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const content = (
    <div className="flex flex-col h-full bg-[#11161a] border-r border-[#232c35] select-none text-slate-300 w-64">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#232c35] flex items-center space-x-3">
        <div className="w-8 h-8 rounded-md bg-[#ff5533]/15 border border-[#ff5533]/40 flex items-center justify-center text-[#ff5533] shadow-tactical-glow">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <div className="font-mono font-bold tracking-wider text-slate-100 text-sm">FIELDLINK</div>
          <div className="text-[10px] tracking-widest text-[#ff5533] uppercase font-mono font-semibold">Tactical Operations</div>
        </div>
      </div>

      {/* Active Device Badge */}
      <div className="p-3 mx-3 my-3 bg-[#161c22] border border-[#232c35] rounded-md flex items-center justify-between">
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded bg-[#232c35] flex items-center justify-center text-slate-300 flex-shrink-0">
            <Smartphone className="w-4 h-4 text-[#ff5533]" />
          </div>
          <div className="truncate">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 font-mono">Active Device</div>
            <div className="text-xs font-mono font-bold text-slate-100 truncate">{activeDevice.deviceName}</div>
          </div>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" title="Device Active"></span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-md text-sm font-medium transition-all group relative ${
                isActive
                  ? 'bg-[#161c22] text-slate-100 font-semibold border-l-2 border-[#ff5533]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#161c22]/50'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-colors ${
                  isActive ? 'text-[#ff5533]' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Vault Status */}
      <div className="p-4 border-t border-[#232c35] bg-[#0d1114]/60 space-y-2">
        <div className="flex items-center space-x-2 text-[11px] font-mono text-emerald-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <div>
            <div className="font-semibold uppercase tracking-wider text-[10px]">Local Vault</div>
            <div className="text-slate-400 text-[9px]">Encrypted · healthy</div>
          </div>
        </div>
        <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest pt-1 border-t border-[#232c35]/50">
          BUILD 0.6.17 // DEMO
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden md:block h-screen flex-shrink-0 sticky top-0 z-30">
        {content}
      </aside>

      {/* Mobile drawer overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onCloseMobile} />
          <div className="relative z-10 w-64 h-full shadow-2xl animate-in slide-in-from-left">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
