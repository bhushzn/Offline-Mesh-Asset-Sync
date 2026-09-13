// FIELDLINK PDF Generator Script
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 40, bottom: 40, left: 45, right: 45 },
  bufferPages: true
});

const outputPath = 'C:/Users/harsh/.gemini/antigravity/scratch/Offline-Mesh-Asset-Sync/FIELDLINK_TACTICAL_ARCHITECTURE_AND_TECH_STACK.pdf';
const writeStream = fs.createWriteStream(outputPath);
doc.pipe(writeStream);

// Helper styles
const colors = {
  primary: '#1e3a8a',
  secondary: '#0284c7',
  darkText: '#0f172a',
  mutedText: '#475569',
  border: '#cbd5e1',
  cardBg: '#f8fafc',
  emerald: '#059669',
  amber: '#d97706',
  rose: '#e11d48'
};

// ==========================================
// PAGE 1: TITLE & CORE ARCHITECTURE
// ==========================================
doc.rect(45, 40, 505, 4).fill(colors.primary);

doc.moveDown(0.8);
doc.font('Helvetica-Bold').fontSize(22).fillColor(colors.primary).text('FIELDLINK: TACTICAL MESH OPERATIONS');
doc.font('Helvetica-Bold').fontSize(11).fillColor(colors.secondary).text('OFFLINE-FIRST DECENTRALIZED ASSET, MUSTER & SITREP COMMAND PLATFORM');
doc.font('Helvetica').fontSize(9).fillColor(colors.mutedText).text('Technical Architecture, Protocol Specifications & Technology Stack Deep Dive · Version 2.0');
doc.moveDown(0.8);
doc.moveTo(45, doc.y).lineTo(550, doc.y).strokeColor(colors.border).stroke();
doc.moveDown(0.8);

// Section 1: Executive Overview
doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text('1. EXECUTIVE SUMMARY & PROBLEM STATEMENT');
doc.moveDown(0.3);
doc.font('Helvetica').fontSize(9.5).fillColor(colors.darkText).text(
  'During severe disaster response, remote tactical deployments, or subterranean missions, traditional cellular and satellite backhauls fail or experience severe electromagnetic jamming. FIELDLINK (Offline-Mesh-Asset-Sync) is an autonomous, mission-critical Progressive Web Application (PWA) designed to provide 100% operational uptime without internet access. Field operators can coordinate gear accountability, personnel muster rolls, pre-mission checklists, and real-time tactical SITREPs across peer devices with zero central server dependency.',
  { lineGap: 2.5 }
);
doc.moveDown(0.8);

// Section 2: End-to-End System Data Flow
doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text('2. END-TO-END DECENTRALIZED DATA FLOW');
doc.moveDown(0.3);

const flowSteps = [
  { step: '1. FIELD OPERATOR ACTION', desc: 'Equipment checkout, casualty report, or muster roll updated locally via UI.' },
  { step: '2. LOCAL ENCRYPTED STORE', desc: 'Immediate write to IndexedDB / Dexie with AES-GCM-256 authenticated encryption.' },
  { step: '3. OFFLINE MUTATION QUEUE', desc: 'CRDT operation generated with Lamport clock, HLC timestamp, and SHA-256 hash.' },
  { step: '4. HYBRID P2P TRANSPORT', desc: 'Opportunistic broadcast across WebRTC DataChannels, BLE Beacons, and LAN sockets.' },
  { step: '5. MULTI-HOP STORE & FORWARD', desc: 'Intermediate relay nodes forward packets using vector routing until target convergence.' },
  { step: '6. DETERMINISTIC CRDT MERGE', desc: 'Last-Write-Wins (LWW) and Merkle Tree verification reconcile conflicting field edits.' },
  { step: '7. COMMAND & 3D VISUALIZATION', desc: 'Live Three.js spatial network and GIS maps update instantly upon convergence.' }
];

flowSteps.forEach((s) => {
  doc.rect(45, doc.y, 505, 22).fillAndStroke(colors.cardBg, colors.border);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(colors.primary).text(s.step, 55, doc.y - 17, { width: 160 });
  doc.font('Helvetica').fontSize(8.5).fillColor(colors.darkText).text(s.desc, 220, doc.y - 17, { width: 320 });
  doc.moveDown(0.55);
});

doc.moveDown(0.5);

// Section 3: Core Technology Stack Breakdown
doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text('3. CORE TECHNOLOGY STACK SPECIFICATION');
doc.moveDown(0.3);

const techStack = [
  { layer: 'Frontend UI & React Core', tech: 'React 19.2, TypeScript 6.0, Vite 8.3 (Fast HMR & ESM chunking)' },
  { layer: 'Spatial Visualization', tech: 'Three.js 0.186, OrbitControls, 3D Raycasting, Canvas Billboard Sprites' },
  { layer: 'Design System & Audio', tech: 'Tailwind CSS 3.4 (Light Tactical Theme), Lucide Icons, Web Audio API' },
  { layer: 'Local Persistence Layer', tech: 'Browser IndexedDB, Dexie.js, LocalStorage snapshots, Service Worker PWA' },
  { layer: 'P2P Mesh Transports', tech: 'WebRTC (RTCPeerConnection), Web Bluetooth API (BLE), Local LAN, Cloud Relay' },
  { layer: 'Conflict Resolution (CRDT)', tech: 'State-based Last-Write-Wins (LWW), Hybrid Logical Clocks (HLC), Vector Clocks' },
  { layer: 'Security & Integrity', tech: 'Web Crypto API (SubtleCrypto), AES-GCM 256-bit encryption, SHA-256 Block Hashes' },
  { layer: 'Verification & Testing', tech: 'Vitest 5.0, Oxlint, In-App Interactive Automated CRDT Verification Test Bench' }
];

techStack.forEach((t) => {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(colors.secondary).text(t.layer + ': ', { continued: true });
  doc.font('Helvetica').fontSize(8.5).fillColor(colors.darkText).text(t.tech);
  doc.moveDown(0.2);
});

// ==========================================
// PAGE 2: P2P MESH & CRDT ENGINE
// ==========================================
doc.addPage();

doc.rect(45, 40, 505, 4).fill(colors.secondary);
doc.moveDown(0.8);
doc.font('Helvetica-Bold').fontSize(16).fillColor(colors.primary).text('DECENTRALIZED TRANSPORT & CRDT ENGINE');
doc.moveTo(45, doc.y).lineTo(550, doc.y).strokeColor(colors.border).stroke();
doc.moveDown(0.8);

// Section 4: Multi-Transport Hybrid Mesh
doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text('4. MULTI-TRANSPORT MESH ARCHITECTURE');
doc.moveDown(0.3);
doc.font('Helvetica').fontSize(9).fillColor(colors.darkText).text(
  'FIELDLINK does not rely on a single physical medium. The TransportManager coordinator abstracts heterogeneous network layers and dynamically selects the highest bandwidth, lowest latency transport available:',
  { lineGap: 2 }
);
doc.moveDown(0.4);

const transports = [
  { name: '1. WebRTC DataChannels (P2P Direct)', desc: 'Zero-relay direct peer browser streams with sub-20ms latency. Transfers binary CRDT operation batches directly between devices on shared subnets or via lightweight signaling.' },
  { name: '2. Web Bluetooth Low Energy (BLE)', desc: 'Short-range hardware beacons for air-gapped field squads where radio silence or zero-infrastructure environment is required. Transmits compact binary deltas (MTU 512 bytes).' },
  { name: '3. Local Network LAN / WebSocket', desc: 'High-throughput tactical base-station synchronization across tactical local area networks, WiFi access points, or rugged field switches.' },
  { name: '4. Cloud Relay Fallback', desc: 'Secure WebSocket relay hub used when backhaul connectivity is intermittently restored to bridge isolated field sectors back to Headquarters.' }
];

transports.forEach((tr) => {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.primary).text(tr.name);
  doc.font('Helvetica').fontSize(8.5).fillColor(colors.darkText).text(tr.desc, { lineGap: 2 });
  doc.moveDown(0.3);
});

doc.moveDown(0.5);

// Section 5: CRDT Conflict-Free Synchronization Math
doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text('5. CONFLICT-FREE REPLICATED DATA TYPE (CRDT) ENGINE');
doc.moveDown(0.3);
doc.font('Helvetica').fontSize(9).fillColor(colors.darkText).text(
  'FIELDLINK guarantees Strong Eventual Consistency (SEC) across all nodes without requiring centralized locking or coordinator elections:',
  { lineGap: 2 }
);
doc.moveDown(0.3);

const crdtDetails = [
  { term: '• Hybrid Logical Clocks (HLC):', desc: 'Combines physical monotonic timestamps with logical Lamport counters to generate causally ordered, globally unique mutation identifiers (Format: <timestamp>-<counter>-<deviceId>).' },
  { term: '• Last-Write-Wins (LWW) Register:', desc: 'Deterministically resolves field-level conflicts across divergent branches. In the rare event of identical HLC timestamps, device ID byte-ordering breaks ties uniformly.' },
  { term: '• Merkle Tree Delta Synchronization:', desc: 'Exchanges cryptographic tree roots between peers to identify missing mutations in O(log N) comparisons, drastically conserving radio battery and bandwidth.' },
  { term: '• Tamper-Evident SHA-256 Audit Trail:', desc: 'Every state mutation and handshake event is chained into an immutable SHA-256 ledger, preventing spoofing and providing auditability.' }
];

crdtDetails.forEach((c) => {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(colors.primary).text(c.term + ' ', { continued: true });
  doc.font('Helvetica').fontSize(8.5).fillColor(colors.darkText).text(c.desc, { lineGap: 2 });
  doc.moveDown(0.25);
});

doc.moveDown(0.6);

// Section 6: Interactive 3D Tactical Mesh Visualizer
doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.primary).text('6. INTERACTIVE 3D TACTICAL MESH VISUALIZER');
doc.moveDown(0.3);
doc.font('Helvetica').fontSize(9).fillColor(colors.darkText).text(
  'The spatial network visualizer is powered by Three.js with hardware-accelerated WebGL rendering. Key features include OrbitControls (orbit, pan, zoom with safe clipping), real-time Raycasting for mouse hover and click selection, floating dynamic sprite billboard labels, animated packet propagation along multi-hop routes, and a rich telemetry inspector panel detailing RSSI, latency, battery levels, and trusted status.',
  { lineGap: 2 }
);

// ==========================================
// PAGE 3: OPERATOR RUNBOOK & GUIDE
// ==========================================
doc.addPage();

doc.rect(45, 40, 505, 4).fill(colors.emerald);
doc.moveDown(0.8);
doc.font('Helvetica-Bold').fontSize(16).fillColor(colors.primary).text('OPERATOR RUNBOOK: HOW TO USE THE PROTOTYPE');
doc.moveTo(45, doc.y).lineTo(550, doc.y).strokeColor(colors.border).stroke();
doc.moveDown(0.8);

doc.font('Helvetica').fontSize(9).fillColor(colors.darkText).text(
  'Follow this step-by-step operational guide to test, demonstrate, and leverage the FIELDLINK prototype to its fullest capability:',
  { lineGap: 2 }
);
doc.moveDown(0.5);

const operationalSteps = [
  {
    num: 'STEP 1: COMMAND DASHBOARD & 3D MESH EXPLORATION',
    points: [
      '• View the top summary bar answering all 8 operational readiness questions at a glance.',
      '• Use the mouse inside the 3D canvas: Left-drag to rotate the mesh, Right-drag to pan, Scroll wheel to zoom.',
      '• Hover over any node (e.g. A-17, B-04, C-12, R-01, M-08) to see glowing link highlights and status tooltips.',
      '• Click a node to open the rich Telemetry Inspector displaying RSSI, battery, latency, and transport type.',
      '• Click "Ping Mesh" to dispatch a multi-hop test packet sweep across all active links with latency feedback.'
    ]
  },
  {
    num: 'STEP 2: DEMO NETWORK FAILURE SIMULATION (ZERO-BANDWIDTH TEST)',
    points: [
      '• Toggle DEMO MODE from the top header or settings.',
      '• In the Network Failure Simulator bench on the dashboard, toggle "Internet / Cloud" to OFFLINE.',
      '• Disconnect Peer B-04 or Node M-08 to simulate radio isolation.',
      '• Notice how FIELDLINK stays 100% responsive, queues operations locally, and displays the offline badge.'
    ]
  },
  {
    num: 'STEP 3: ASSET & EQUIPMENT ACCOUNTABILITY',
    points: [
      '• Navigate to "Assets & Equipment" to search, filter by category/condition, and check out items.',
      '• Click "+ New Asset" to create gear or use the QR Scanner Simulator to simulate scanning barcodes.',
      '• Change asset status from "Available" to "Deployed" to trigger automatic CRDT mutation generation.'
    ]
  },
  {
    num: 'STEP 4: PERSONNEL MUSTER & ROLL CALL SESSIONS',
    points: [
      '• Navigate to "Personnel & Muster" to review tactical fireteam accountability.',
      '• Click "Start Roll Call Session" to conduct live attendance (Present, Absent, Missing, Injured).',
      '• Submit the session to write an immutable roll-call record and update the composite readiness score.'
    ]
  },
  {
    num: 'STEP 5: TACTICAL CHECKLISTS & SITREP INCIDENT LOGGING',
    points: [
      '• Navigate to "Checklists" to execute pre-flight or trauma triage verification with live progress rings.',
      '• Navigate to "Incidents / SITREP" or click "Report SITREP" on Dashboard to broadcast urgent casualty or perimeter alerts with coordinates and severity ratings.'
    ]
  },
  {
    num: 'STEP 6: SYNC CENTER, VERIFICATION SUITE & VAULT BACKUP',
    points: [
      '• Navigate to "Sync Center" to inspect the 8-stage convergence pipeline, CRDT queues, and peer links.',
      '• Click "Verify CRDT" in the top header to run the built-in automated test suite verifying deterministic convergence.',
      '• In "Settings", export full encrypted JSON vault snapshots for cold backup or air-gapped migration.'
    ]
  }
];

operationalSteps.forEach((s) => {
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(colors.primary).text(s.num);
  doc.moveDown(0.15);
  s.points.forEach((p) => {
    doc.font('Helvetica').fontSize(8.5).fillColor(colors.darkText).text(p, { lineGap: 1.5 });
  });
  doc.moveDown(0.35);
});

// Footer Page Numbers
const totalPages = doc.bufferedPageRange().count;
for (let i = 0; i < totalPages; i++) {
  doc.switchToPage(i);
  doc.font('Helvetica').fontSize(8).fillColor(colors.mutedText).text(
    `FIELDLINK Tactical Operations · Confidential Technical Specification · Page ${i + 1} of ${totalPages}`,
    45,
    790,
    { align: 'center', width: 505 }
  );
}

doc.end();

writeStream.on('finish', () => {
  console.log('PDF Report generated successfully at:', outputPath);
});
