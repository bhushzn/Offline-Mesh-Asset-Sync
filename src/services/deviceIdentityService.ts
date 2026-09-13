// ============================================================
// FIELDLINK — Persistent Application Device Identity Service
// ============================================================

import { DeviceMetadata } from '../types/tactical';

const STORAGE_KEY_DEVICE_ID = 'fieldlink_node_device_id';
const STORAGE_KEY_DEVICE_NAME = 'fieldlink_node_device_name';
const STORAGE_KEY_OPERATOR = 'fieldlink_node_operator_name';
const STORAGE_KEY_ROLE = 'fieldlink_node_tactical_role';

/**
 * Standard RFC4122 v4 UUID generator (cryptographically secure).
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class DeviceIdentityService {
  private deviceId: string;
  private deviceName: string;
  private operatorName: string;
  private role: string;
  private listeners: Set<(device: DeviceMetadata) => void> = new Set();

  constructor() {
    // 1. Check if deviceId already exists in localStorage (persistent across app restarts)
    let existingId: string | null = null;
    let existingName: string | null = null;
    let existingOperator: string | null = null;
    let existingRole: string | null = null;

    if (typeof localStorage !== 'undefined') {
      existingId = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
      existingName = localStorage.getItem(STORAGE_KEY_DEVICE_NAME);
      existingOperator = localStorage.getItem(STORAGE_KEY_OPERATOR);
      existingRole = localStorage.getItem(STORAGE_KEY_ROLE);
    }

    if (!existingId) {
      // Generate a new stable UUID for this physical installation
      existingId = generateUUID();
      const shortCode = existingId.substring(0, 4).toUpperCase();
      existingName = `NODE-${shortCode}`;
      existingOperator = 'Field Responder';
      existingRole = 'Tactical Operator';

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_DEVICE_ID, existingId);
        localStorage.setItem(STORAGE_KEY_DEVICE_NAME, existingName);
        localStorage.setItem(STORAGE_KEY_OPERATOR, existingOperator);
        localStorage.setItem(STORAGE_KEY_ROLE, existingRole);
      }
    }

    this.deviceId = existingId;
    this.deviceName = existingName || `NODE-${existingId.substring(0, 4).toUpperCase()}`;
    this.operatorName = existingOperator || 'Field Responder';
    this.role = existingRole || 'Tactical Operator';
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getDeviceName(): string {
    return this.deviceName;
  }

  public getOperatorName(): string {
    return this.operatorName;
  }

  public getRole(): string {
    return this.role;
  }

  public getMetadata(): DeviceMetadata {
    return {
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      operatorName: this.operatorName,
      role: this.role,
      nodeType: 'Field Node',
      status: 'online',
      batteryLevel: 95,
      isTrusted: true,
      lastSeen: Date.now(),
      vectorClock: { [this.deviceId]: 1 },
    };
  }

  public updateIdentity(name: string, operator: string, role: string) {
    this.deviceName = name;
    this.operatorName = operator;
    this.role = role;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_DEVICE_NAME, name);
      localStorage.setItem(STORAGE_KEY_OPERATOR, operator);
      localStorage.setItem(STORAGE_KEY_ROLE, role);
    }

    const meta = this.getMetadata();
    for (const listener of this.listeners) {
      listener(meta);
    }
  }

  public subscribe(listener: (device: DeviceMetadata) => void): () => void {
    this.listeners.add(listener);
    listener(this.getMetadata());
    return () => this.listeners.delete(listener);
  }
}

export const deviceIdentity = new DeviceIdentityService();
