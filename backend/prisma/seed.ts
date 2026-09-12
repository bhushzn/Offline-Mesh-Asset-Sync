// ============================================================
// TacSync Backend — Database Seed Script
// ============================================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding TacSync database with tactical data...');

  // Clean existing records in reverse dependency order
  await prisma.auditLog.deleteMany({});
  await prisma.syncOperation.deleteMany({});
  await prisma.syncSession.deleteMany({});
  await prisma.incidentAsset.deleteMany({});
  await prisma.incidentPersonnel.deleteMany({});
  await prisma.incident.deleteMany({});
  await prisma.checklistRecord.deleteMany({});
  await prisma.checklistTemplate.deleteMany({});
  await prisma.rollCallEntry.deleteMany({});
  await prisma.rollCall.deleteMany({});
  await prisma.assetDeployment.deleteMany({});
  await prisma.asset.deleteMany({});
  await prisma.personnel.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.unit.deleteMany({});

  // ── 1. Create Units ──────────────────────────────────────────
  const commandHQ = await prisma.unit.create({
    data: {
      name: 'Joint Tactical Task Force HQ',
      callsign: 'APEX-HQ',
      description: 'Central Tactical Command for Disaster Relief & Field Ops',
    },
  });

  const alphaSquad = await prisma.unit.create({
    data: {
      name: 'Alpha Contingent (Search & Rescue)',
      callsign: 'ALPHA-01',
      description: 'Rapid Search and Mountain Rescue Element',
      parentUnitId: commandHQ.id,
    },
  });

  const bravoSquad = await prisma.unit.create({
    data: {
      name: 'Bravo Contingent (Medical & Logistics)',
      callsign: 'BRAVO-02',
      description: 'Emergency Field Medical and Resource Relay',
      parentUnitId: commandHQ.id,
    },
  });

  // ── 2. Create Users ──────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Tactical@2026', 10);

  const commander = await prisma.user.create({
    data: {
      email: 'commander@tacsync.mil',
      name: 'Maj. Vikramaditya Singh',
      passwordHash,
      role: 'COMMANDER',
      unitId: commandHQ.id,
    },
  });

  const teamLeaderAlpha = await prisma.user.create({
    data: {
      email: 'alpha.lead@tacsync.mil',
      name: 'Capt. Priya Sharma',
      passwordHash,
      role: 'TEAM_LEADER',
      unitId: alphaSquad.id,
    },
  });

  const teamLeaderBravo = await prisma.user.create({
    data: {
      email: 'bravo.lead@tacsync.mil',
      name: 'Capt. Rajesh Nair',
      passwordHash,
      role: 'TEAM_LEADER',
      unitId: bravoSquad.id,
    },
  });

  const operator = await prisma.user.create({
    data: {
      email: 'operator1@tacsync.mil',
      name: 'Sgt. Arjun Reddy',
      passwordHash,
      role: 'FIELD_OPERATOR',
      unitId: alphaSquad.id,
    },
  });

  // ── 3. Create Devices ────────────────────────────────────────
  const device1 = await prisma.device.create({
    data: {
      deviceFingerprint: 'DEV-MIL-RUGGED-001-A',
      name: 'Alpha Rugged Pad Alpha-1',
      userId: teamLeaderAlpha.id,
      unitId: alphaSquad.id,
      status: 'ACTIVE',
      metadata: { os: 'Android 14 Mesh-Edition', battery: 94, bleActive: true },
    },
  });

  const device2 = await prisma.device.create({
    data: {
      deviceFingerprint: 'DEV-MIL-RUGGED-002-B',
      name: 'Bravo Tactical Tablet Bravo-1',
      userId: teamLeaderBravo.id,
      unitId: bravoSquad.id,
      status: 'ACTIVE',
      metadata: { os: 'Android 14 Mesh-Edition', battery: 88, bleActive: true },
    },
  });

  // ── 4. Create Personnel ──────────────────────────────────────
  const p1 = await prisma.personnel.create({
    data: {
      name: 'Capt. Priya Sharma',
      callsign: 'VALKYRIE-1',
      role: 'Contingent Commander',
      rank: 'Captain',
      status: 'ACTIVE',
      unitId: alphaSquad.id,
    },
  });

  const p2 = await prisma.personnel.create({
    data: {
      name: 'Sgt. Arjun Reddy',
      callsign: 'STRIKER-2',
      role: 'Lead Scout / Breacher',
      rank: 'Sergeant',
      status: 'ACTIVE',
      unitId: alphaSquad.id,
    },
  });

  const p3 = await prisma.personnel.create({
    data: {
      name: 'Cpl. Deepa Menon',
      callsign: 'MEDIC-3',
      role: 'Combat Paramedic',
      rank: 'Corporal',
      status: 'ACTIVE',
      unitId: alphaSquad.id,
    },
  });

  const p4 = await prisma.personnel.create({
    data: {
      name: 'Capt. Rajesh Nair',
      callsign: 'SENTINEL-1',
      role: 'Logistics Officer',
      rank: 'Captain',
      status: 'ACTIVE',
      unitId: bravoSquad.id,
    },
  });

  const p5 = await prisma.personnel.create({
    data: {
      name: 'Sgt. Neha Patel',
      callsign: 'CIRCUIT-2',
      role: 'Comms / Mesh Relay Specialist',
      rank: 'Sergeant',
      status: 'ACTIVE',
      unitId: bravoSquad.id,
    },
  });

  // ── 5. Create Assets ─────────────────────────────────────────
  const a1 = await prisma.asset.create({
    data: {
      name: 'AN/PRC-152A Tactical Handheld Radio',
      serialNumber: 'TACRAD-2026-081',
      category: 'Communications',
      condition: 'SERVICEABLE',
      status: 'DEPLOYED',
      unitId: alphaSquad.id,
      location: 'Forward Outpost Echo',
    },
  });

  const a2 = await prisma.asset.create({
    data: {
      name: 'Skydio X2D Rugged Recon Drone',
      serialNumber: 'UAV-SKYD-902',
      category: 'Reconnaissance',
      condition: 'SERVICEABLE',
      status: 'DEPLOYED',
      unitId: alphaSquad.id,
      location: 'Alpha Mobile Command',
    },
  });

  const a3 = await prisma.asset.create({
    data: {
      name: 'FLIR Breach PTQ136 Thermal Monocular',
      serialNumber: 'THRM-FLIR-441',
      category: 'Optics',
      condition: 'SERVICEABLE',
      status: 'AVAILABLE',
      unitId: alphaSquad.id,
      location: 'Armory Locker 4',
    },
  });

  const a4 = await prisma.asset.create({
    data: {
      name: 'Combat Trauma Field Kit Advanced (CTFK-A)',
      serialNumber: 'MED-KIT-770',
      category: 'Medical',
      condition: 'SERVICEABLE',
      status: 'DEPLOYED',
      unitId: bravoSquad.id,
      location: 'Field Clinic Tent 2',
    },
  });

  // ── 6. Deployments ───────────────────────────────────────────
  await prisma.assetDeployment.create({
    data: {
      assetId: a1.id,
      assignedToId: p2.id,
      assignedById: teamLeaderAlpha.id,
      status: 'ACTIVE',
      location: 'Ridge Patrol Sector 4',
      notes: 'Assigned for satellite mesh relay',
    },
  });

  await prisma.assetDeployment.create({
    data: {
      assetId: a2.id,
      assignedToId: p1.id,
      assignedById: teamLeaderAlpha.id,
      status: 'ACTIVE',
      location: 'Ridge Patrol Sector 4',
      notes: 'Aerial scouting operation',
    },
  });

  // ── 7. Checklist Templates & Records ─────────────────────────
  const t1 = await prisma.checklistTemplate.create({
    data: {
      name: 'Pre-Mission Equipment & Comm Sync Check',
      description: 'Mandatory pre-departure equipment muster and mesh network verification',
      unitId: alphaSquad.id,
      items: [
        { id: 'item-1', label: 'Primary Mesh Radio Battery > 80%', required: true, order: 1 },
        { id: 'item-2', label: 'BLE / Wi-Fi Direct Peer Discovery Verified', required: true, order: 2 },
        { id: 'item-3', label: 'Local Tactical DB Cache Fresh (HLC Synchronized)', required: true, order: 3 },
        { id: 'item-4', label: 'Personal First Aid Kit (IFAK) Inspected', required: true, order: 4 },
        { id: 'item-5', label: 'Emergency Beacon Frequency Confirmed', required: true, order: 5 },
      ],
    },
  });

  await prisma.checklistRecord.create({
    data: {
      templateId: t1.id,
      assignedToId: teamLeaderAlpha.id,
      deviceId: device1.id,
      status: 'COMPLETED',
      completedAt: new Date(),
      entries: [
        { itemId: 'item-1', checked: true, checkedAt: new Date().toISOString() },
        { itemId: 'item-2', checked: true, checkedAt: new Date().toISOString() },
        { itemId: 'item-3', checked: true, checkedAt: new Date().toISOString() },
        { itemId: 'item-4', checked: true, checkedAt: new Date().toISOString() },
        { itemId: 'item-5', checked: true, checkedAt: new Date().toISOString() },
      ],
      notes: 'All items verified before sortie Alpha-9.',
    },
  });

  // ── 8. Roll Call ─────────────────────────────────────────────
  const rollCall = await prisma.rollCall.create({
    data: {
      unitId: alphaSquad.id,
      initiatedById: teamLeaderAlpha.id,
      deviceId: device1.id,
      status: 'COMPLETED',
      completedAt: new Date(),
      notes: 'Morning muster roll call at Forward Operating Base Echo',
      entries: {
        create: [
          { personnelId: p1.id, status: 'PRESENT', deviceId: device1.id },
          { personnelId: p2.id, status: 'PRESENT', deviceId: device1.id },
          { personnelId: p3.id, status: 'ON_MISSION', notes: 'Dispatched with Medevac team', deviceId: device1.id },
        ],
      },
    },
  });

  // ── 9. Incident Report ───────────────────────────────────────
  const incident = await prisma.incident.create({
    data: {
      type: 'Terrain Hazard / Landslide',
      severity: 'SEV4_HIGH',
      title: 'Sector 4 Ridge Access Blocked by Rockfall',
      description: 'Heavy precipitation triggered moderate rockfall on route Echo-Bravo. Access restricted to foot patrol with mountaineering harness only.',
      location: '32.1492° N, 76.3218° E (Sector 4 Gully)',
      reporterId: teamLeaderAlpha.id,
      unitId: alphaSquad.id,
      deviceId: device1.id,
      status: 'IN_PROGRESS',
      personnel: { create: [{ personnelId: p2.id, role: 'first responder' }] },
      assets: { create: [{ assetId: a2.id, role: 'aerial reconnaissance' }] },
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log(`Users created: Commander (${commander.email}), Alpha Lead (${teamLeaderAlpha.email}), Operator (${operator.email}) - Password: Tactical@2026`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
