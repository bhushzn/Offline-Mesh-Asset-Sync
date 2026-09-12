// FIELDLINK Tactical Types & CRDT Data Models

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed';

export interface BaseTacticalEntity {
  id: string;
  version: number;
  updatedAt: number;
  updatedByDeviceId: string;
  syncStatus: SyncStatus;
  isDeleted?: boolean;
  lamportClock: number;
}

export type AssetCategory = 'Medical' | 'Comms' | 'Weapons' | 'Mobility' | 'Power' | 'Tactical Gear';
export type AssetCondition = 'Good' | 'Operational' | 'Degraded' | 'Critical';
export type AssetStatus = 'Available' | 'Deployed' | 'Maintenance' | 'Missing';

export interface Asset extends BaseTacticalEntity {
  customId: string; // e.g. "MK-204"
  name: string;
  category: AssetCategory;
  condition: AssetCondition;
  status: AssetStatus;
  assignment: string; // e.g. "South sector", "Alpha Lead", "Unassigned"
  sector: string;
  serialNumber: string;
  notes: string;
}

export interface AssetDeployment extends BaseTacticalEntity {
  assetId: string;
  assetName: string;
  assignedToPersonnelId?: string;
  assignedToName: string;
  locationSector: string;
  deployedAt: number;
  returnExpectedAt?: number;
  returnedAt?: number;
  status: 'Active' | 'Returned' | 'Transferred';
  notes: string;
}

export type PersonnelStatus = 'Active' | 'Deployed' | 'Rest' | 'Injured' | 'MIA';
export type RollCallStatus = 'Present' | 'Absent' | 'Missing' | 'Injured' | 'Other';

export interface Personnel extends BaseTacticalEntity {
  callsign: string;
  name: string;
  rank: string;
  unit: string;
  role: string;
  bloodType: string;
  status: PersonnelStatus;
  currentSector: string;
  equipmentCount: number;
  lastRollCallStatus: RollCallStatus;
}

export interface RollCallEntry {
  personnelId: string;
  personnelName: string;
  status: RollCallStatus;
  timestamp: number;
  notes?: string;
}

export interface RollCallRecord extends BaseTacticalEntity {
  title: string;
  sector: string;
  startedAt: number;
  completedAt?: number;
  operatorName: string;
  deviceId: string;
  status: 'In Progress' | 'Completed';
  entries: Record<string, RollCallEntry>; // personnelId -> entry
  summary: {
    total: number;
    present: number;
    absent: number;
    missing: number;
    injured: number;
    other: number;
  };
}

export type ChecklistCategory = 'Equipment Inspection' | 'Deployment Prep' | 'Emergency Response' | 'Medical Triage' | 'Vehicle Check';

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: number;
  notes?: string;
}

export interface ChecklistExecution extends BaseTacticalEntity {
  title: string;
  category: ChecklistCategory;
  status: 'In Progress' | 'Completed';
  items: ChecklistItem[];
  progress: {
    completed: number;
    total: number;
  };
}

export type IncidentType = 'Medical Emergency' | 'Equipment Failure' | 'Comms Blackout' | 'Perimeter Alert' | 'Hazard Warning' | 'Supply Shortage';
export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type IncidentStatus = 'Open' | 'Monitoring' | 'Resolved' | 'Escalated';

export interface Incident extends BaseTacticalEntity {
  incidentCode: string; // e.g. "INC-883"
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  locationSector: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  reporter: string;
  relatedPersonnelIds: string[];
  relatedAssetIds: string[];
  status: IncidentStatus;
  reportedAt: number;
  resolvedAt?: number;
}

export interface DeviceMetadata {
  deviceId: string;
  deviceName: string;
  operatorName: string;
  role: string;
  nodeType: 'North Node' | 'Delta Patrol' | 'Relay Gateway' | 'Command Hub';
  status: 'online' | 'offline' | 'syncing';
  batteryLevel: number;
  isTrusted: boolean;
  lastSeen: number;
  vectorClock: Record<string, number>;
}

export interface CRDTOperation {
  id: string; // unique op ID
  entityType: 'asset' | 'personnel' | 'deployment' | 'roll_call' | 'checklist' | 'incident' | 'device';
  entityId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'MERGE';
  payload: any;
  vectorClock: Record<string, number>;
  lamportClock: number;
  timestamp: number;
  originDeviceId: string;
  syncedWithPeers: string[];
  hash: string;
}

export interface SyncQueueItem {
  id: string;
  opId: string;
  operation: CRDTOperation;
  status: SyncStatus;
  retries: number;
  lastAttempt?: number;
  errorMessage?: string;
}

export interface PeerNode {
  deviceId: string;
  deviceName: string;
  role: string;
  nodeType: string;
  rssi: number;
  status: 'online' | 'syncing' | 'discovered' | 'disconnected';
  lastSyncAt: number;
  latencyMs: number;
  connectionType: 'WebRTC' | 'BroadcastChannel' | 'BLE_Simulated';
  position3D?: [number, number, number];
}

export interface SyncStats {
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  lastSyncTime: number | null;
  activePeersCount: number;
  totalOpsCount: number;
}
