import { Incident, IncidentSeverity, IncidentStatus, IncidentType } from '../../types/tactical';

export const incidentMapper = {
  toBackendPayload: (inc: Incident) => ({
    id: inc.id,
    title: `${inc.type} - ${inc.incidentCode}`,
    incidentCode: inc.incidentCode,
    description: inc.description,
    severity: inc.severity === 'Critical' ? 'SEV5_CRITICAL' : inc.severity === 'High' ? 'SEV4_HIGH' : inc.severity === 'Medium' ? 'SEV3_MODERATE' : 'SEV1_MINOR',
    status: inc.status === 'Resolved' ? 'RESOLVED' : inc.status === 'Monitoring' ? 'IN_PROGRESS' : 'OPEN',
    location: inc.locationSector,
    coordinates: inc.coordinates,
    reportedBy: inc.reporter,
    reportedAt: new Date(inc.reportedAt || Date.now()).toISOString(),
    version: inc.version
  }),

  toFrontendEntity: (raw: any): Incident => ({
    id: raw.id,
    incidentCode: raw.incidentCode || `INC-${raw.id.slice(0, 4)}`,
    type: (raw.type as IncidentType) || 'Medical Emergency',
    severity: (raw.severity === 'SEV5_CRITICAL' ? 'Critical' : raw.severity === 'SEV4_HIGH' ? 'High' : raw.severity === 'SEV3_MODERATE' ? 'Medium' : raw.severity || 'Medium') as IncidentSeverity,
    description: raw.description || '',
    locationSector: raw.location || raw.locationSector || 'Sector Alpha',
    coordinates: raw.coordinates,
    reporter: raw.reportedBy || raw.reporter || 'Field Operator',
    relatedPersonnelIds: raw.relatedPersonnelIds || [],
    relatedAssetIds: raw.relatedAssetIds || [],
    status: (raw.status === 'RESOLVED' ? 'Resolved' : raw.status === 'IN_PROGRESS' ? 'Monitoring' : raw.status || 'Open') as IncidentStatus,
    reportedAt: raw.reportedAt ? new Date(raw.reportedAt).getTime() : Date.now(),
    resolvedAt: raw.resolvedAt ? new Date(raw.resolvedAt).getTime() : undefined,
    version: raw.version || 1,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).getTime() : Date.now(),
    updatedByDeviceId: raw.updatedByDeviceId || 'system',
    syncStatus: 'synced',
    lamportClock: raw.lamportClock || 1
  })
};
