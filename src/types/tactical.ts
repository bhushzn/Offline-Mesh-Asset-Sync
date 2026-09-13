// FIELDLINK Tactical Types & Canonical Domain Models

export type OperatingMode = 'FIELD_MODE' | 'ONLINE_MODE' | 'DEMO_MODE';

export interface NetworkDiagnostics {
  internet: 'ONLINE' | 'OFFLINE';
  localSignaling: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  webrtc: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'NO_PEERS';
  mesh: 'ACTIVE' | 'INACTIVE';
  cloud: 'ONLINE' | 'DISABLED' | 'UNAVAILABLE';
  activePeersCount: number;
  pendingOpsCount: number;
  lastSyncTime: number | null;
  signalingUrl: string;
}

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'failed';

export type SyncQueueState = 
  | 'PENDING'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'REMOTE_RECEIVED'
  | 'REMOTE_VALIDATED'
  | 'REMOTE_MERGED'
  | 'ACK_RECEIVED'
  | 'SYNCED'
  | 'FAILED';

export interface BaseTacticalEntity {
  id: string;
  version: number;
  updatedAt: number;
  updatedByDeviceId: string;
  syncStatus: SyncStatus;
  isDeleted?: boolean;
  lamportClock: number;
  hlcTimestamp?: string;
}

// -------------------------------------------------------------
// Assets & Equipment
// -------------------------------------------------------------
export type AssetCategory = 'Medical' | 'Comms' | 'Weapons' | 'Mobility' | 'Power' | 'Tactical Gear';
export type AssetCondition = 'Good' | 'Operational' | 'Degraded' | 'Critical';
export type AssetStatus = 'Available' | 'Deployed' | 'Maintenance' | 'Missing';

export interface Asset extends BaseTacticalEntity {
  customId: string; // e.g. "MK-204"
  name: string;
  category: AssetCategory;
  condition: AssetCondition;
  status: AssetStatus;
  assignment: string;
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

// -------------------------------------------------------------
// Personnel & Muster Roll
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// Checklists
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// Incidents (SITREP)
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// Devices & Transport Abstraction
// -------------------------------------------------------------
export type TransportType = 'WebRTC' | 'BLE' | 'LocalNetwork' | 'Cloud' | 'Simulated';
export type TransportStatus = 'available' | 'connected' | 'connecting' | 'disconnected' | 'unavailable';

export interface TransportCapabilities {
  type: TransportType;
  isAvailable: boolean;
  isSupported: boolean;
  latencyMs: number;
  bandwidthKbps?: number;
  mtuBytes?: number;
  notes?: string;
}

export interface DeviceMetadata {
  deviceId: string;
  deviceName: string;
  operatorName: string;
  role: string;
  nodeType: 'North Node' | 'Delta Patrol' | 'Relay Gateway' | 'Command Hub' | 'Field Node';
  status: 'online' | 'offline' | 'syncing';
  batteryLevel: number;
  isTrusted: boolean;
  lastSeen: number;
  vectorClock: Record<string, number>;
  publicKey?: string;
  transportType?: TransportType;
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
  connectionType: TransportType;
  isSimulated?: boolean;
  isTrusted: boolean;
  batteryLevel?: number;
  position3D?: [number, number, number];
}

// -------------------------------------------------------------
// CRDT & Sync Queue
// -------------------------------------------------------------
export interface CRDTOperation {
  id: string; // unique op ID (UUID or hash)
  entityType: 'asset' | 'personnel' | 'deployment' | 'roll_call' | 'checklist' | 'incident' | 'device';
  entityId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'MERGE';
  payload: any;
  vectorClock: Record<string, number>;
  lamportClock: number;
  hlcTimestamp: string;
  timestamp: number;
  originDeviceId: string;
  syncedWithPeers: string[];
  hash: string; // SHA-256 integrity hash
  signature?: string;
}

export interface SyncQueueItem {
  id: string;
  opId: string;
  operation: CRDTOperation;
  state: SyncQueueState;
  status: SyncStatus;
  retries: number;
  maxRetries: number;
  nextAttemptAt?: number;
  lastAttemptAt?: number;
  errorMessage?: string;
  acknowledgedByPeers: string[];
  targetPeerId?: string;
  createdAt: number;
}

// -------------------------------------------------------------
// Structured Sync Protocol Messages
// -------------------------------------------------------------
export type SyncMessageType = 
  | 'HELLO'
  | 'CAPABILITIES'
  | 'AUTH_REQUEST'
  | 'AUTH_RESPONSE'
  | 'SYNC_REQUEST'
  | 'SYNC_RESPONSE'
  | 'OPERATION'
  | 'OPERATION_BATCH'
  | 'SYNC_ACK'
  | 'SYNC_COMPLETE'
  | 'HEARTBEAT'
  | 'TEST_PING'
  | 'ERROR';

export interface SyncMessage<T = any> {
  msgId: string;
  type: SyncMessageType;
  senderDeviceId: string;
  targetDeviceId?: string; // empty for broadcast
  timestamp: number;
  vectorClock: Record<string, number>;
  hlcTimestamp: string;
  payload: T;
  nonce?: string;
  signature?: string;
}

// -------------------------------------------------------------
// Store-and-Forward Mesh Packets
// -------------------------------------------------------------
export interface MeshPacket {
  packetId: string;
  originDeviceId: string;
  destinationDeviceId: string; // 'BROADCAST' or specific ID
  ttl: number; // Max hops remaining (e.g. 4)
  hopCount: number;
  path: string[]; // e.g. ["A-17", "B-04", "COMMAND"]
  payload: SyncMessage;
  timestamp: number;
  hash: string;
}

// -------------------------------------------------------------
// Conflict Resolution Audit Log
// -------------------------------------------------------------
export interface ConflictRecord {
  id?: string;
  conflictId: string;
  entityType: string;
  entityId: string;
  nodeAId: string;
  nodeAValue: any;
  nodeATimestamp: string;
  nodeBId: string;
  nodeBValue: any;
  nodeBTimestamp: string;
  resolutionRule: 'LWW_HLC_WINNER' | 'VECTOR_DOMINANCE' | 'MERGE_SET';
  winningNodeId: string;
  winningValue: any;
  resolvedAt: number;
}

// -------------------------------------------------------------
// Local Event Audit Trail
// -------------------------------------------------------------
export interface AuditEvent {
  id: string;
  timestamp: number;
  deviceId: string;
  eventType: 
    | 'DATA_MODIFIED'
    | 'PEER_DISCOVERED'
    | 'PEER_CONNECTED'
    | 'PEER_DISCONNECTED'
    | 'SYNC_INITIATED'
    | 'SYNC_COMPLETED'
    | 'CONFLICT_RESOLVED'
    | 'AUTH_VERIFIED'
    | 'PACKET_FORWARDED'
    | 'OFFLINE_FALLBACK'
    | 'PEER_MESSAGE'
    | 'ERROR';
  entityType?: string;
  entityId?: string;
  details: string;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
}

// -------------------------------------------------------------
// Readiness Score
// -------------------------------------------------------------
export interface ReadinessScore {
  overallScore: number; // 0 - 100%
  assetScore: number;    // Weight: 30%
  personnelScore: number;// Weight: 30%
  checklistScore: number;// Weight: 20%
  incidentScore: number; // Weight: 20%
  lastCalculatedAt: number;
  details: {
    assetsAvailable: number;
    assetsTotal: number;
    personnelAccounted: number;
    personnelTotal: number;
    checklistsCompleted: number;
    checklistsTotal: number;
    criticalIncidents: number;
  };
}

export interface SyncStats {
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  lastSyncTime: number | null;
  activePeersCount: number;
  totalOpsCount: number;
  opsExchanged?: number;
  conflictsResolved?: number;
}

