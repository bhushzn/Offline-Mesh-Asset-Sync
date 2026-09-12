// ============================================================
// TacSync Backend — Checklist Service
// ============================================================

import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { recordAudit } from '../events/auditService.js';
import type { ChecklistStatus } from '@prisma/client';

export interface ChecklistItemDef {
  id: string;
  label: string;
  required: boolean;
  order: number;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  unitId?: string;
  items: ChecklistItemDef[];
}

export interface CreateRecordInput {
  templateId: string;
  assignedToId?: string;
  deviceId?: string;
}

export interface ChecklistEntryData {
  itemId: string;
  checked: boolean;
  checkedAt?: string;
  checkedById?: string;
}

// ── Templates ─────────────────────────────────────────────────

export async function createTemplate(input: CreateTemplateInput, userId: string) {
  const template = await prisma.checklistTemplate.create({
    data: {
      name: input.name,
      description: input.description,
      unitId: input.unitId,
      items: input.items as any,
    },
  });

  await recordAudit({
    userId,
    entityType: 'ChecklistTemplate',
    entityId: template.id,
    action: 'CREATE',
    metadata: { name: template.name, itemCount: input.items.length },
  });

  return template;
}

export async function getTemplates(filters: { unitId?: string; skip?: number; take?: number }) {
  const where: Record<string, unknown> = { isActive: true };
  if (filters.unitId) where.unitId = filters.unitId;

  const [templates, total] = await Promise.all([
    prisma.checklistTemplate.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.checklistTemplate.count({ where: where as any }),
  ]);

  return { templates, total };
}

export async function updateTemplate(
  id: string,
  input: Partial<CreateTemplateInput>,
  userId: string,
) {
  const existing = await prisma.checklistTemplate.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('ChecklistTemplate', id);

  const template = await prisma.checklistTemplate.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      items: input.items as any,
      version: { increment: 1 },
    },
  });

  await recordAudit({
    userId,
    entityType: 'ChecklistTemplate',
    entityId: id,
    action: 'UPDATE',
  });

  return template;
}

// ── Records ───────────────────────────────────────────────────

export async function createRecord(input: CreateRecordInput, userId: string) {
  const template = await prisma.checklistTemplate.findUnique({ where: { id: input.templateId } });
  if (!template) throw new NotFoundError('ChecklistTemplate', input.templateId);

  // Initialize all entries as unchecked
  const items = template.items as unknown as ChecklistItemDef[];
  const entries: ChecklistEntryData[] = items.map((item) => ({
    itemId: item.id,
    checked: false,
  }));

  const record = await prisma.checklistRecord.create({
    data: {
      templateId: input.templateId,
      assignedToId: input.assignedToId,
      deviceId: input.deviceId,
      entries: entries as any,
      status: 'NOT_STARTED',
    },
    include: { template: { select: { id: true, name: true, items: true } } },
  });

  await recordAudit({
    userId,
    entityType: 'ChecklistRecord',
    entityId: record.id,
    action: 'CREATE',
    metadata: { templateId: input.templateId },
  });

  return record;
}

export async function getRecords(filters: {
  templateId?: string;
  assignedToId?: string;
  status?: ChecklistStatus;
  skip?: number;
  take?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters.templateId) where.templateId = filters.templateId;
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.status) where.status = filters.status;

  const [records, total] = await Promise.all([
    prisma.checklistRecord.findMany({
      where: where as any,
      include: { template: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.checklistRecord.count({ where: where as any }),
  ]);

  return { records, total };
}

export async function updateRecord(
  id: string,
  data: { entries?: ChecklistEntryData[]; status?: ChecklistStatus; notes?: string },
  userId: string,
) {
  const existing = await prisma.checklistRecord.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('ChecklistRecord', id);

  // Compute status from entries if entries are provided
  let status = data.status;
  if (data.entries && !status) {
    const allChecked = data.entries.every((e) => e.checked);
    const anyChecked = data.entries.some((e) => e.checked);
    status = allChecked ? 'COMPLETED' : anyChecked ? 'IN_PROGRESS' : 'NOT_STARTED';
  }

  const record = await prisma.checklistRecord.update({
    where: { id },
    data: {
      entries: data.entries as any,
      status,
      notes: data.notes,
      completedAt: status === 'COMPLETED' ? new Date() : null,
      version: { increment: 1 },
    },
    include: { template: { select: { id: true, name: true, items: true } } },
  });

  await recordAudit({
    userId,
    entityType: 'ChecklistRecord',
    entityId: id,
    action: 'UPDATE',
    metadata: { status },
  });

  return record;
}
