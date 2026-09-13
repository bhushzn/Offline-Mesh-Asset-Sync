// FIELDLINK Multi-Node Demo Bar & Simulation Controller
import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  Smartphone, 
  Sparkles, 
  PlayCircle 
} from 'lucide-react';
import { DeviceMetadata } from '../../types/tactical';
import { syncQueue } from '../../services/syncQueueService';
import { p2pMesh } from '../../services/p2pMeshService';
import { syncManager } from '../../services/syncManager';
import { offlineStorage, STORES } from '../../services/offlineStorageService';
import { tacticalAudio } from '../../utils/audio';

const DEMO_NODES: DeviceMetadata[] = [
  {
    deviceId: 'device-a17',
    deviceName: 'A-17 / NORTH NODE',
    operatorName: 'Lina Okafor',
    role: 'Field Lead',
    nodeType: 'North Node',
    status: 'online',
    batteryLevel: 94,
    isTrusted: true,
    lastSeen: Date.now(),
    vectorClock: { 'device-a17': 4, 'device-b04': 2 },
  },
  {
    deviceId: 'device-b04',
    deviceName: 'B-04 / DELTA PATROL',
    operatorName: 'Marcus Vance',
    role: 'Scout Lead',
    nodeType: 'Delta Patrol',
    status: 'online',
    batteryLevel: 82,
    isTrusted: true,
    lastSeen: Date.now(),
    vectorClock: { 'device-a17': 2, 'device-b04': 5 },
  },
  {
    deviceId: 'device-r01',
    deviceName: 'R-01 / COMMAND RELAY',
    operatorName: 'HQ Relay Operator',
    role: 'HQ Gateway',
    nodeType: 'Command Hub',
    status: 'online',
    batteryLevel: 100,
    isTrusted: true,
    lastSeen: Date.now(),
    vectorClock: { 'device-a17': 4, 'device-b04': 4, 'device-r01': 8 },
  },
];

interface Props {
  activeDevice: DeviceMetadata;
  setActiveDevice: (device: DeviceMetadata) => void;
}

export const DemoNodeSelector: React.FC<Props> = ({ activeDevice, setActiveDevice }) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStepText, setSimStepText] = useState<string | null>(null);

  const handleSelectNode = (node: DeviceMetadata) => {
    tacticalAudio.playClick();
    setActiveDevice(node);
    syncQueue.setDeviceId(node.deviceId);
    p2pMesh.setLocalDevice(node.deviceId, node.deviceName, node.role);
    offlineStorage.put(STORES.DEVICE_METADATA, node);
  };

  // Run End-to-End Automated Demo Scenario
  const handleRunDemoScenario = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    tacticalAudio.playClick();

    try {
      // Step 1: Switch to Node A-17
      setSimStepText('Step 1/5: Node A-17 modifying asset MK-204 offline...');
      handleSelectNode(DEMO_NODES[0]);
      await new Promise((r) => setTimeout(r, 900));

      // Create offline mutation on Node A
      const updatedAsset = {
        id: 'asset-mk204',
        customId: 'MK-204',
        name: 'Trauma response kit',
        category: 'Medical' as const,
        condition: 'Good' as const,
        status: 'Deployed' as const,
        assignment: 'North Sector Patrol',
        sector: 'Sector-1A',
        serialNumber: 'SN-TRK-9921',
        notes: 'Assigned to Lead Lina Okafor during sweep.',
        updatedAt: Date.now(),
        updatedByDeviceId: 'device-a17',
        version: 2,
        lamportClock: syncQueue.getLamportClock() + 1,
        syncStatus: 'pending' as const,
      };
      await offlineStorage.put(STORES.ASSETS, updatedAsset);
      await syncQueue.enqueueMutation('asset', 'asset-mk204', 'UPDATE', updatedAsset);

      // Step 2: Switch to Node B-04
      setSimStepText('Step 2/5: Node B-04 logging urgent incident INC-884 offline...');
      handleSelectNode(DEMO_NODES[1]);
      await new Promise((r) => setTimeout(r, 1100));

      // Create offline incident on Node B
      const newIncident = {
        id: 'inc-demo-884',
        incidentCode: 'INC-884',
        type: 'Perimeter Alert' as const,
        severity: 'High' as const,
        description: 'Unidentified sensor tripwire triggered at south ridge waypoint 4.',
        locationSector: 'South Ridge WP-4',
        reporter: 'Marcus Vance (Delta Scout)',
        relatedPersonnelIds: ['pers-02'],
        relatedAssetIds: ['asset-drn09'],
        status: 'Open' as const,
        reportedAt: Date.now(),
        updatedAt: Date.now(),
        updatedByDeviceId: 'device-b04',
        version: 1,
        lamportClock: syncQueue.getLamportClock() + 1,
        syncStatus: 'pending' as const,
      };
      await offlineStorage.put(STORES.INCIDENTS, newIncident);
      await syncQueue.enqueueMutation('incident', 'inc-demo-884', 'CREATE', newIncident);

      // Step 3: Proximity detection & Peer Handshake
      setSimStepText('Step 3/5: Devices enter proximity → P2P Discovery Handshake...');
      await new Promise((r) => setTimeout(r, 1200));

      // Step 4: CRDT Vector Clock & Delta Exchange
      setSimStepText('Step 4/5: Exchanging delta operations & CRDT LWW merge...');
      await syncManager.syncAllPeers();
      await new Promise((r) => setTimeout(r, 1400));

      // Step 5: Convergence Complete
      setSimStepText('Step 5/5: Synchronization Complete! Both nodes converged.');
      tacticalAudio.playSyncSuccess();
      try {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.85 },
          colors: ['#10b981', '#06b6d4', '#ff5533'],
        });
      } catch {
        //
      }

      await new Promise((r) => setTimeout(r, 2200));
    } finally {
      setIsSimulating(false);
      setSimStepText(null);
    }
  };

  return (
    <div className="bg-[#11161a] border-t border-[#232c35] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
      {/* Node Selector Pills */}
      <div className="flex items-center space-x-2 flex-wrap">
        <span className="text-slate-400 text-[11px] flex items-center space-x-1">
          <Smartphone className="w-3.5 h-3.5 text-[#ff5533]" />
          <span>Active Node:</span>
        </span>

        {DEMO_NODES.map((node) => {
          const isSelected = activeDevice.deviceId === node.deviceId;
          return (
            <button
              key={node.deviceId}
              onClick={() => handleSelectNode(node)}
              className={`px-2.5 py-1 rounded text-xs transition flex items-center space-x-1.5 ${
                isSelected
                  ? 'bg-[#161c22] text-[#ff5533] border border-[#ff5533]/50 font-bold shadow-tactical-glow'
                  : 'bg-[#161c22]/60 text-slate-400 border border-[#232c35] hover:text-slate-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSelected ? 'bg-[#ff5533] animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span>{node.deviceName}</span>
            </button>
          );
        })}
      </div>

      {/* Demo Scenario Controller */}
      <div className="flex items-center space-x-3">
        {simStepText ? (
          <div className="text-[11px] text-cyan-300 bg-cyan-950/60 px-3 py-1 rounded border border-cyan-800 animate-pulse flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>{simStepText}</span>
          </div>
        ) : (
          <button
            onClick={handleRunDemoScenario}
            disabled={isSimulating}
            className="px-3 py-1 rounded bg-gradient-to-r from-emerald-600/80 to-teal-600/80 hover:from-emerald-500 hover:to-teal-500 text-slate-900 font-bold border border-emerald-400/40 transition flex items-center space-x-1.5 shadow-emerald-glow"
          >
            <PlayCircle className="w-3.5 h-3.5 fill-current" />
            <span>Simulate Multi-Node Offline Sync</span>
          </button>
        )}
      </div>
    </div>
  );
};
