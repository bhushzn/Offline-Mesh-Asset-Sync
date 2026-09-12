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
  Map,
  FileText
} from 'lucide-react';
import { DeviceMetadata } from '../../types/tactical';
import { tacticalAudio } from '../../utils/audio';

export type ActiveTab = 'dashboard' | 'assets' | 'personnel' | 'checklists' | 'incidents' | 'map' | 'sync' | 'audit' | 'settings';

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
    { id: 'assets', label: 'Assets & Equipment', icon: Package },
    { id: 'personnel', label: 'Personnel / Muster', icon: Users },
    { id: 'checklists', label: 'Checklists', icon: CheckSquare },
    { id: 'incidents', label: 'Incident Log (SITREP)', icon: AlertTriangle },
    { id: 'map', label: 'Tactical GIS Map', icon: Map },
    { id: 'sync', label: 'Sync Center', icon: Share2 },
    { id: 'audit', label: 'Audit Trail', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  const handleNav = (id: ActiveTab) => {
    tacticalAudio.playClick();
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 select-none text-slate-700 w-64">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-200 flex items-center space-x-3 bg-slate-50/50">
        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <div className="font-sans font-bold tracking-tight text-slate-900 text-base">FIELDLINK</div>
          <div className="text-[10px] tracking-wider text-blue-700 uppercase font-mono font-semibold">Mesh Operations</div>
        </div>
      </div>

      {/* Active Device Badge */}
      <div className="p-3 mx-3 my-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0">
            <Smartphone className="w-4 h-4 text-blue-600" />
          </div>
          <div className="truncate">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 font-mono font-semibold">Active Node</div>
            <div className="text-xs font-mono font-bold text-slate-900 truncate">{activeDevice.deviceName}</div>
          </div>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100 flex-shrink-0" title="Device Active"></span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative touch-target-min ${
                isActive
                  ? 'bg-blue-50 text-blue-900 font-semibold border-l-3 border-blue-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-colors flex-shrink-0 ${
                  isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Vault Status */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-2">
        <div className="flex items-center space-x-2 text-[11px] font-mono text-emerald-700">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <div>
            <div className="font-semibold uppercase tracking-wider text-[10px]">Encrypted Vault</div>
            <div className="text-slate-500 text-[10px]">AES-GCM 256 · Offline Active</div>
          </div>
        </div>
        <div className="text-[9px] font-mono text-slate-400 uppercase tracking-widest pt-1 border-t border-slate-200">
          FIELDLINK v2.0 // PROD
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
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="relative z-10 w-64 h-full shadow-xl animate-in slide-in-from-left">
            {content}
          </div>
        </div>
      )}
    </>
  );
};

