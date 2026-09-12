import { ChecklistExecution, ChecklistCategory } from '../../types/tactical';

export const checklistMapper = {
  toBackendPayload: (chk: ChecklistExecution) => ({
    id: chk.id,
    title: chk.title,
    category: chk.category,
    status: chk.status === 'Completed' ? 'COMPLETED' : 'IN_PROGRESS',
    items: chk.items,
    completedCount: chk.progress.completed,
    totalCount: chk.progress.total,
    version: chk.version,
    updatedAt: new Date(chk.updatedAt).toISOString()
  }),

  toFrontendEntity: (raw: any): ChecklistExecution => ({
    id: raw.id,
    title: raw.title || 'Operational Checklist',
    category: (raw.category as ChecklistCategory) || 'Equipment Inspection',
    status: raw.status === 'COMPLETED' ? 'Completed' : 'In Progress',
    items: raw.items || [],
    progress: raw.progress || {
      completed: raw.completedCount || 0,
      total: raw.totalCount || (raw.items ? raw.items.length : 0)
    },
    version: raw.version || 1,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).getTime() : Date.now(),
    updatedByDeviceId: raw.updatedByDeviceId || 'system',
    syncStatus: 'synced',
    lamportClock: raw.lamportClock || 1
  })
};
