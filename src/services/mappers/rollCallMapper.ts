import { RollCallRecord, RollCallStatus } from '../../types/tactical';

export const rollCallMapper = {
  toBackendPayload: (record: RollCallRecord) => ({
    id: record.id,
    title: record.title,
    location: record.sector,
    status: record.status === 'Completed' ? 'COMPLETED' : 'IN_PROGRESS',
    startedAt: new Date(record.startedAt).toISOString(),
    completedAt: record.completedAt ? new Date(record.completedAt).toISOString() : null,
    totalPersonnel: record.summary.total,
    presentCount: record.summary.present,
    missingCount: record.summary.missing,
    entries: record.entries,
    version: record.version
  }),

  toFrontendEntity: (raw: any): RollCallRecord => ({
    id: raw.id,
    title: raw.title || 'Muster Roll Call',
    sector: raw.location || raw.sector || 'Main Base',
    startedAt: raw.startedAt ? new Date(raw.startedAt).getTime() : Date.now(),
    completedAt: raw.completedAt ? new Date(raw.completedAt).getTime() : undefined,
    operatorName: raw.operatorName || 'System',
    deviceId: raw.deviceId || 'local-device',
    status: raw.status === 'COMPLETED' ? 'Completed' : 'In Progress',
    entries: raw.entries || {},
    summary: raw.summary || {
      total: raw.totalPersonnel || 0,
      present: raw.presentCount || 0,
      absent: raw.absentCount || 0,
      missing: raw.missingCount || 0,
      injured: raw.injuredCount || 0,
      other: 0
    },
    version: raw.version || 1,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).getTime() : Date.now(),
    updatedByDeviceId: raw.updatedByDeviceId || 'system',
    syncStatus: 'synced',
    lamportClock: raw.lamportClock || 1
  })
};
