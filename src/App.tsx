// FIELDLINK Root Application
import React, { useEffect, useState } from 'react';
import { ActiveTab, Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/views/DashboardView';
import { AssetsView } from './components/views/AssetsView';
import { PersonnelView } from './components/views/PersonnelView';
import { ChecklistsView } from './components/views/ChecklistsView';
import { IncidentsView } from './components/views/IncidentsView';
import { SyncCenterView } from './components/views/SyncCenterView';
import { SettingsView } from './components/views/SettingsView';
import { DemoNodeSelector } from './components/demo/DemoNodeSelector';
import { AutomatedTestSuiteModal } from './components/test/AutomatedTestSuiteModal';
import { DeviceMetadata, SyncStats } from './types/tactical';
import { DEFAULT_DEVICE, seedDatabaseIfEmpty } from './services/seedData';
import { syncManager } from './services/syncManager';
import { tacticalAudio } from './utils/audio';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [activeDevice, setActiveDevice] = useState<DeviceMetadata>(DEFAULT_DEVICE);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTestSuiteOpen, setIsTestSuiteOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [syncStats, setSyncStats] = useState<SyncStats>({
    pendingCount: 0,
    syncedCount: 6,
    failedCount: 0,
    lastSyncTime: Date.now(),
    activePeersCount: 4,
    totalOpsCount: 12,
  });

  useEffect(() => {
    // 1. Seed database with realistic tactical data
    seedDatabaseIfEmpty();

    // 2. Listen to network status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. Subscribe to sync manager stats
    const unsubStats = syncManager.subscribeStats((stats) => {
      setSyncStats(stats);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubStats();
    };
  }, []);

  const handleManualSync = async () => {
    await syncManager.syncAllPeers();
    tacticalAudio.playSyncSuccess();
  };

  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Dashboard';
      case 'assets':
        return 'Assets';
      case 'personnel':
        return 'Personnel';
      case 'checklists':
        return 'Checklists';
      case 'incidents':
        return 'Incidents';
      case 'sync':
        return 'Sync Center';
      case 'settings':
        return 'Settings';
      default:
        return 'Field Operations';
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#0a0d0f] text-slate-200 overflow-hidden font-sans select-none">
      {/* Tactical Left Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeDevice={activeDevice}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <Header
          breadcrumb={getBreadcrumbTitle()}
          activeDevice={activeDevice}
          syncStats={syncStats}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenTestSuite={() => setIsTestSuiteOpen(true)}
          onManualSync={handleManualSync}
          isOnline={isOnline}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto tactical-grid-bg relative pb-16">
          {activeTab === 'dashboard' && (
            <DashboardView
              onNavigate={(tab) => setActiveTab(tab)}
              onOpenLogIncident={() => setActiveTab('incidents')}
              syncStats={syncStats}
              activeDevice={activeDevice}
            />
          )}
          {activeTab === 'assets' && <AssetsView />}
          {activeTab === 'personnel' && <PersonnelView />}
          {activeTab === 'checklists' && <ChecklistsView />}
          {activeTab === 'incidents' && <IncidentsView />}
          {activeTab === 'sync' && <SyncCenterView syncStats={syncStats} />}
          {activeTab === 'settings' && (
            <SettingsView
              activeDevice={activeDevice}
              setActiveDevice={setActiveDevice}
              isOnline={isOnline}
              setIsOnline={setIsOnline}
              soundEnabled={soundEnabled}
              setSoundEnabled={setSoundEnabled}
            />
          )}
        </main>

        {/* Bottom Multi-Node Demo Simulation Bar */}
        <div className="sticky bottom-0 z-20">
          <DemoNodeSelector
            activeDevice={activeDevice}
            setActiveDevice={setActiveDevice}
          />
        </div>
      </div>

      {/* Automated Verification Test Suite Modal */}
      <AutomatedTestSuiteModal
        isOpen={isTestSuiteOpen}
        onClose={() => setIsTestSuiteOpen(false)}
      />
    </div>
  );
}

export default App;
