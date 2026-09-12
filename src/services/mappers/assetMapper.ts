import { Asset, AssetCategory, AssetCondition, AssetStatus } from '../../types/tactical';

export const AssetConditionMap = {
  toBackend: (condition: AssetCondition): string => {
    switch (condition) {
      case 'Good': return 'SERVICEABLE';
      case 'Operational': return 'SERVICEABLE';
      case 'Degraded': return 'DAMAGED';
      case 'Critical': return 'UNDER_REPAIR';
      default: return 'SERVICEABLE';
    }
  },
  toFrontend: (condition: string): AssetCondition => {
    switch (condition) {
      case 'SERVICEABLE': return 'Operational';
      case 'DAMAGED': return 'Degraded';
      case 'UNDER_REPAIR': return 'Critical';
      case 'UNSERVICEABLE': return 'Critical';
      case 'LOST': return 'Critical';
      default: return 'Operational';
    }
  }
};

export const AssetStatusMap = {
  toBackend: (status: AssetStatus): string => {
    switch (status) {
      case 'Available': return 'AVAILABLE';
      case 'Deployed': return 'DEPLOYED';
      case 'Maintenance': return 'MAINTENANCE';
      case 'Missing': return 'LOST';
      default: return 'AVAILABLE';
    }
  },
  toFrontend: (status: string): AssetStatus => {
    switch (status) {
      case 'AVAILABLE': return 'Available';
      case 'DEPLOYED': return 'Deployed';
      case 'MAINTENANCE': return 'Maintenance';
      case 'LOST': return 'Missing';
      case 'DECOMMISSIONED': return 'Maintenance';
      default: return 'Available';
    }
  }
};

export const assetMapper = {
  toBackendPayload: (asset: Asset) => ({
    id: asset.id,
    serialNumber: asset.serialNumber || asset.customId,
    name: asset.name,
    category: asset.category,
    condition: AssetConditionMap.toBackend(asset.condition),
    status: AssetStatusMap.toBackend(asset.status),
    currentLocation: asset.sector,
    assignedToId: asset.assignment !== 'Unassigned' ? asset.assignment : undefined,
    notes: asset.notes,
    version: asset.version,
    updatedAt: new Date(asset.updatedAt).toISOString()
  }),

  toFrontendEntity: (raw: any): Asset => ({
    id: raw.id,
    customId: raw.serialNumber || raw.customId || 'MK-000',
    name: raw.name,
    category: (raw.category as AssetCategory) || 'Tactical Gear',
    condition: AssetConditionMap.toFrontend(raw.condition),
    status: AssetStatusMap.toFrontend(raw.status),
    assignment: raw.assignedToName || raw.assignment || 'Unassigned',
    sector: raw.currentLocation || raw.sector || 'Main Base',
    serialNumber: raw.serialNumber || '',
    notes: raw.notes || '',
    version: raw.version || 1,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).getTime() : Date.now(),
    updatedByDeviceId: raw.updatedByDeviceId || 'system',
    syncStatus: 'synced',
    lamportClock: raw.lamportClock || 1,
    hlcTimestamp: raw.hlcTimestamp
  })
};
