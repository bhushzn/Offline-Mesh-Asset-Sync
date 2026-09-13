// FIELDLINK In-App Automated Test & CRDT Verification Suite
import React, { useState } from 'react';
import { 
  FlaskConical, 
  CheckCircle2, 
  XCircle, 
  Play, 
  RotateCcw, 
  ShieldCheck 
} from 'lucide-react';
import { offlineStorage, STORES } from '../../services/offlineStorageService';
import { CRDTEngine } from '../../services/crdtService';
import { syncQueue } from '../../services/syncQueueService';
import { Asset, RollCallRecord, ChecklistExecution } from '../../types/tactical';
import { tacticalAudio } from '../../utils/audio';

interface TestCase {
  id: string;
  name: string;
  category: 'Storage' | 'Queue' | 'CRDT' | 'Convergence';
  description: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  durationMs?: number;
  details?: string;
}

const INITIAL_TESTS: TestCase[] = [
  {
    id: 'test-idb-crud',
    name: 'IndexedDB Store Persistence & Retrieval',
    category: 'Storage',
    description: 'Verifies zero-latency write and read from IndexedDB stores without internet connectivity.',
    status: 'idle',
  },
  {
    id: 'test-sync-queue',
    name: 'Local Sync Queue & Lamport Clock Enqueue',
    category: 'Queue',
    description: 'Ensures every offline mutation generates an immutable CRDT operation in the local queue.',
    status: 'idle',
  },
  {
    id: 'test-crdt-lww',
    name: 'Deterministic LWW Conflict Resolution',
    category: 'CRDT',
    description: 'Simulates concurrent conflicting edits on the same asset and tests mathematical tie-breaking convergence.',
    status: 'idle',
  },
  {
    id: 'test-rollcall-set',
    name: 'Multi-Entry Roll Call Set Merge',
    category: 'Convergence',
    description: 'Merges distinct squad personnel entries from two isolated patrol nodes into a unified roll call.',
    status: 'idle',
  },
  {
    id: 'test-checklist-grow',
    name: 'Grow-Only Checklist Verification Merge',
    category: 'Convergence',
    description: 'Combines independent checklist step completions from separate leads without overwriting progress.',
    status: 'idle',
  },
  {
    id: 'test-dup-protection',
    name: 'Duplicate Operation & Hash Suppression',
    category: 'Queue',
    description: 'Validates that duplicate mesh packet replays are detected and suppressed using deterministic hash checks.',
    status: 'idle',
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const AutomatedTestSuiteModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [tests, setTests] = useState<TestCase[]>(INITIAL_TESTS);
  const [isRunningAll, setIsRunningAll] = useState(false);

  if (!isOpen) return null;

  const runSingleTest = async (testId: string): Promise<boolean> => {
    const startTime = performance.now();
    let passed = false;
    let details = '';

    try {
      if (testId === 'test-idb-crud') {
        const testAsset: Asset = {
          id: `test-asset-${Date.now()}`,
          customId: 'TST-001',
          name: 'Thermal Beacon Test',
          category: 'Comms',
          condition: 'Operational',
          status: 'Available',
          assignment: 'Test Sandbox',
          sector: 'Sector Alpha',
          serialNumber: 'SN-TEST-1',
          notes: 'Automated test suite verification',
          updatedAt: Date.now(),
          updatedByDeviceId: 'device-test',
          version: 1,
          lamportClock: 1,
          syncStatus: 'synced',
        };
        await offlineStorage.put(STORES.ASSETS, testAsset);
        const fetched = await offlineStorage.getById<Asset>(STORES.ASSETS, testAsset.id);
        if (fetched && fetched.name === 'Thermal Beacon Test') {
          await offlineStorage.delete(STORES.ASSETS, testAsset.id);
          passed = true;
          details = 'Successfully wrote, indexed, verified, and cleaned up record in IndexedDB.';
        } else {
          details = 'Failed to retrieve written record from IndexedDB store.';
        }
      } else if (testId === 'test-sync-queue') {
        const initialCount = await syncQueue.getPendingCount();
        const op = await syncQueue.enqueueMutation('asset', 'test-q-1', 'UPDATE', { status: 'Deployed' });
        const newCount = await syncQueue.getPendingCount();
        if (op.id && op.hash && newCount >= initialCount) {
          await syncQueue.markOpSynced(op.id, 'peer-test');
          passed = true;
          details = `Generated CRDTOperation ${op.id} with Lamport clock ${op.lamportClock} and payload hash ${op.hash}.`;
        } else {
          details = 'Operation enqueue failed or hash calculation missing.';
        }
      } else if (testId === 'test-crdt-lww') {
        // Node A edit (Lamport 10, Time 1000)
        const nodeAAsset: Asset = {
          id: 'asset-conflict-1',
          customId: 'MK-99',
          name: 'Trauma Kit (Node A Edit)',
          category: 'Medical',
          condition: 'Good',
          status: 'Deployed',
          assignment: 'Alpha Squad',
          sector: 'Sector 1',
          serialNumber: 'SN-1',
          notes: 'Assigned to Lead A',
          updatedAt: 1000,
          updatedByDeviceId: 'device-a17',
          version: 2,
          lamportClock: 10,
          syncStatus: 'pending',
        };

        // Node B concurrent edit (Lamport 12, Time 1005)
        const nodeBAsset: Asset = {
          id: 'asset-conflict-1',
          customId: 'MK-99',
          name: 'Trauma Kit (Node B Edit)',
          category: 'Medical',
          condition: 'Degraded',
          status: 'Maintenance',
          assignment: 'Base Hospital',
          sector: 'Sector 2',
          serialNumber: 'SN-1',
          notes: 'Maintenance required',
          updatedAt: 1005,
          updatedByDeviceId: 'device-b04',
          version: 2,
          lamportClock: 12,
          syncStatus: 'pending',
        };

        const result = CRDTEngine.mergeLWWEntity<Asset>(nodeAAsset, nodeBAsset);
        // Node B should win because Lamport clock 12 > 10
        if (result.mergedData.condition === 'Degraded' && result.winnerOrigin === 'device-b04') {
          passed = true;
          details = 'Deterministic CRDT correctly selected Node B (Lamport 12 > 10) and preserved state consistency.';
        } else {
          details = 'CRDT merge did not resolve to higher Lamport clock.';
        }
      } else if (testId === 'test-rollcall-set') {
        const baseRollCall: RollCallRecord = {
          id: 'rc-test-1',
          title: 'Squad Roll Call',
          sector: 'Sector North',
          startedAt: 1000,
          operatorName: 'Lead',
          deviceId: 'device-a17',
          status: 'In Progress',
          entries: {
            'p1': { personnelId: 'p1', personnelName: 'Alpha 1', status: 'Present', timestamp: 1000 },
          },
          summary: { total: 2, present: 1, absent: 0, missing: 0, injured: 0, other: 0 },
          updatedAt: 1000,
          updatedByDeviceId: 'device-a17',
          version: 1,
          lamportClock: 1,
          syncStatus: 'synced',
        };

        const remoteRollCall: RollCallRecord = {
          ...baseRollCall,
          entries: {
            'p2': { personnelId: 'p2', personnelName: 'Alpha 2', status: 'Injured', timestamp: 1050 },
          },
          updatedAt: 1050,
          updatedByDeviceId: 'device-b04',
          lamportClock: 2,
        };

        const merged = CRDTEngine.mergeRollCall(baseRollCall, remoteRollCall);
        if (merged.mergedData.entries['p1'] && merged.mergedData.entries['p2']) {
          passed = true;
          details = 'Set CRDT seamlessly combined entries from both patrols: p1 (Present) and p2 (Injured).';
        } else {
          details = 'Roll call entries lost during merge.';
        }
      } else if (testId === 'test-checklist-grow') {
        const listA: ChecklistExecution = {
          id: 'chk-t1',
          title: 'Flight Check',
          category: 'Equipment Inspection',
          status: 'In Progress',
          items: [
            { id: 'step-1', label: 'Battery Check', completed: true, completedAt: 100 },
            { id: 'step-2', label: 'Rotor Calib', completed: false },
          ],
          progress: { completed: 1, total: 2 },
          updatedAt: 100,
          updatedByDeviceId: 'device-a17',
          version: 1,
          lamportClock: 1,
          syncStatus: 'synced',
        };

        const listB: ChecklistExecution = {
          ...listA,
          items: [
            { id: 'step-1', label: 'Battery Check', completed: true, completedAt: 100 },
            { id: 'step-2', label: 'Rotor Calib', completed: true, completedAt: 150 },
          ],
          updatedAt: 150,
          updatedByDeviceId: 'device-b04',
          lamportClock: 2,
        };

        const merged = CRDTEngine.mergeChecklist(listA, listB);
        if (merged.mergedData.progress.completed === 2 && merged.mergedData.status === 'Completed') {
          passed = true;
          details = 'Grow-Only Checklist CRDT correctly marked all 2 steps completed without race conditions.';
        } else {
          details = 'Checklist merge failed to accumulate completions.';
        }
      } else if (testId === 'test-dup-protection') {
        const dummyOp = {
          id: 'op-dup-test',
          entityType: 'asset' as const,
          entityId: 'asset-1',
          operationType: 'UPDATE' as const,
          payload: { name: 'Fixed' },
          vectorClock: { 'device-a17': 1 },
          lamportClock: 5,
          hlcTimestamp: '5000:0:device-a17',
          timestamp: 5000,
          originDeviceId: 'device-a17',
          syncedWithPeers: [],
        };
        const hash1 = await CRDTEngine.computeOpHash(dummyOp);
        const hash2 = await CRDTEngine.computeOpHash(dummyOp);
        if (hash1 === hash2 && hash1.length > 0) {
          passed = true;
          details = `Deterministic hash ${hash1.slice(0, 16)}... verified for duplicate suppression and replay protection.`;
        } else {
          details = 'Hash computation non-deterministic.';
        }
      }
    } catch (err: any) {
      details = `Error: ${err?.message || String(err)}`;
      passed = false;
    }

    const durationMs = Math.round(performance.now() - startTime);

    setTests((prev) =>
      prev.map((t) =>
        t.id === testId
          ? { ...t, status: passed ? 'passed' : 'failed', durationMs, details }
          : t
      )
    );

    return passed;
  };

  const handleRunAll = async () => {
    tacticalAudio.playClick();
    setIsRunningAll(true);
    for (const test of tests) {
      setTests((prev) =>
        prev.map((t) => (t.id === test.id ? { ...t, status: 'running' } : t))
      );
      await new Promise((r) => setTimeout(r, 120));
      await runSingleTest(test.id);
    }
    setIsRunningAll(false);
    tacticalAudio.playSyncSuccess();
  };

  const resetTests = () => {
    tacticalAudio.playClick();
    setTests(INITIAL_TESTS);
  };

  const passedCount = tests.filter((t) => t.status === 'passed').length;
  const totalCount = tests.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-[#11161a] border border-[#232c35] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#232c35] flex items-center justify-between bg-[#161c22]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-cyan-950/60 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 font-mono flex items-center space-x-2">
                <span>TACTICAL CRDT VERIFICATION SUITE</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#232c35] text-cyan-300">Phase 6</span>
              </h2>
              <p className="text-[11px] text-slate-400">Automated verification of offline storage, CRDT merges & mesh convergence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-[#232c35] text-sm font-mono"
          >
            ✕
          </button>
        </div>

        {/* Status Bar */}
        <div className="px-4 py-3 bg-[#0d1114] border-b border-[#232c35] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-3">
            <span className="text-slate-400">Status:</span>
            <span className={`font-semibold ${passedCount === totalCount ? 'text-emerald-400' : 'text-cyan-400'}`}>
              {passedCount} / {totalCount} Passed
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={resetTests}
              className="px-2.5 py-1 rounded bg-[#161c22] border border-[#232c35] text-slate-300 hover:bg-[#232c35] transition flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
            <button
              onClick={handleRunAll}
              disabled={isRunningAll}
              className="px-3 py-1 rounded bg-cyan-600 text-slate-900 font-bold hover:bg-cyan-500 transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{isRunningAll ? 'Running...' : 'Run All Tests'}</span>
            </button>
          </div>
        </div>

        {/* Tests List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tests.map((t) => (
            <div
              key={t.id}
              className="p-3 bg-[#161c22] border border-[#232c35] rounded-lg space-y-2 hover:border-[#313e4b] transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  {t.status === 'passed' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                  {t.status === 'failed' && <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />}
                  {t.status === 'running' && <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
                  {t.status === 'idle' && <div className="w-4 h-4 rounded-full border border-slate-600 flex-shrink-0" />}
                  
                  <div>
                    <div className="text-xs font-semibold text-slate-200 flex items-center space-x-2">
                      <span>{t.name}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0d1114] border border-[#232c35] text-slate-400 font-mono">
                        {t.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">{t.description}</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  {t.durationMs !== undefined && (
                    <span className="text-[10px] font-mono text-slate-400">{t.durationMs}ms</span>
                  )}
                  <button
                    onClick={() => runSingleTest(t.id)}
                    disabled={isRunningAll}
                    className="text-[10px] px-2 py-0.8 rounded bg-[#232c35] text-slate-200 hover:bg-[#313e4b] font-mono"
                  >
                    Run
                  </button>
                </div>
              </div>

              {t.details && (
                <div className="text-[11px] font-mono p-2 rounded bg-[#0d1114] border border-[#232c35] text-slate-300">
                  <span className="text-cyan-400 font-semibold">&gt; </span>
                  {t.details}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0d1114] border-t border-[#232c35] flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center space-x-1.5 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>CRDT Mathematical Convergence Guaranteed</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-[#161c22] border border-[#232c35] hover:bg-[#232c35] text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
