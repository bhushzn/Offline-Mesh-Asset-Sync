import { AuditEvent } from '../types/tactical';
import { offlineStorage, STORES } from './offlineStorageService';

export class AuditLogService {
  private inMemoryLogs: AuditEvent[] = [];
  private listeners = new Set<(logs: AuditEvent[]) => void>();

  constructor() {
    this.loadInitialLogs();
  }

  private async loadInitialLogs() {
    try {
      const stored = await offlineStorage.getAll<AuditEvent>(STORES.AUDIT_LOGS);
      if (stored && stored.length > 0) {
        this.inMemoryLogs = stored.sort((a, b) => b.timestamp - a.timestamp);
      } else {
        // Seed initial audit log
        this.log({
          deviceId: 'local-device',
          eventType: 'DATA_MODIFIED',
          details: 'Tactical system audit log engine initialized',
          severity: 'INFO',
        });
      }
      this.notify();
    } catch {
      // ignore
    }
  }

  public async log(event: Omit<AuditEvent, 'id' | 'timestamp'> & { timestamp?: number }): Promise<AuditEvent> {
    const newEvent: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: event.timestamp || Date.now(),
      deviceId: event.deviceId,
      eventType: event.eventType,
      entityType: event.entityType,
      entityId: event.entityId,
      details: event.details,
      severity: event.severity,
    };

    this.inMemoryLogs.unshift(newEvent);
    if (this.inMemoryLogs.length > 1000) {
      this.inMemoryLogs.pop();
    }

    try {
      await offlineStorage.put(STORES.AUDIT_LOGS, newEvent);
    } catch {
      // local memory fallback
    }

    this.notify();
    return newEvent;
  }

  public getLogs(filter?: { severity?: string; eventType?: string; search?: string }): AuditEvent[] {
    let list = [...this.inMemoryLogs];
    if (filter?.severity && filter.severity !== 'ALL') {
      list = list.filter(l => l.severity === filter.severity);
    }
    if (filter?.eventType && filter.eventType !== 'ALL') {
      list = list.filter(l => l.eventType === filter.eventType);
    }
    if (filter?.search) {
      const term = filter.search.toLowerCase();
      list = list.filter(l => l.details.toLowerCase().includes(term) || (l.entityId && l.entityId.toLowerCase().includes(term)));
    }
    return list;
  }

  public subscribe(listener: (logs: AuditEvent[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const logs = this.getLogs();
    for (const listener of this.listeners) {
      listener(logs);
    }
  }
}

export const auditLog = new AuditLogService();
