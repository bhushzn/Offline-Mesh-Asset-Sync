import { Personnel, PersonnelStatus, RollCallStatus } from '../../types/tactical';

export const personnelMapper = {
  toBackendPayload: (person: Personnel) => ({
    id: person.id,
    callsign: person.callsign,
    firstName: person.name.split(' ')[0] || person.name,
    lastName: person.name.split(' ').slice(1).join(' ') || '',
    rank: person.rank,
    unit: person.unit,
    role: person.role,
    bloodType: person.bloodType,
    status: person.status === 'Active' ? 'ACTIVE' : person.status === 'Deployed' ? 'DEPLOYED' : 'INACTIVE',
    currentLocation: person.currentSector,
    version: person.version,
    updatedAt: new Date(person.updatedAt).toISOString()
  }),

  toFrontendEntity: (raw: any): Personnel => ({
    id: raw.id,
    callsign: raw.callsign || 'OPERATOR',
    name: raw.name || `${raw.firstName || ''} ${raw.lastName || ''}`.trim() || 'Unknown Operator',
    rank: raw.rank || 'Specialist',
    unit: raw.unit || 'Alpha Squad',
    role: raw.role || 'Operator',
    bloodType: raw.bloodType || 'O+',
    status: raw.status === 'ACTIVE' ? 'Active' : raw.status === 'DEPLOYED' ? 'Deployed' : 'Active',
    currentSector: raw.currentLocation || raw.currentSector || 'Base Hub',
    equipmentCount: raw.equipmentCount || 0,
    lastRollCallStatus: (raw.lastRollCallStatus as RollCallStatus) || 'Present',
    version: raw.version || 1,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).getTime() : Date.now(),
    updatedByDeviceId: raw.updatedByDeviceId || 'system',
    syncStatus: 'synced',
    lamportClock: raw.lamportClock || 1,
    hlcTimestamp: raw.hlcTimestamp
  })
};
