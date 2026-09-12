import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  AlertTriangle, 
  RefreshCw 
} from 'lucide-react';
import { ActiveTab } from './Sidebar';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingSyncCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  pendingSyncCount = 0,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Home', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'assets', label: 'Assets', icon: <Package className="w-5 h-5" /> },
    { id: 'personnel', label: 'Muster', icon: <Users className="w-5 h-5" /> },
    { id: 'incidents', label: 'Report', icon: <AlertTriangle className="w-5 h-5" /> },
    { 
      id: 'sync', 
      label: 'Sync', 
      icon: <RefreshCw className="w-5 h-5" />, 
      badge: pendingSyncCount > 0 ? pendingSyncCount : undefined 
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 shadow-lg">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-lg relative touch-target-min transition-all ${
                isActive ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                {item.icon}
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2 px-1.5 py-0.2 text-[9px] font-bold bg-amber-500 text-white rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
