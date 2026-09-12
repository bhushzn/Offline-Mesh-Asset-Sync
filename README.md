# 🌐 TacSync — Zero-Bandwidth Tactical Asset & Checklist Sync

An offline-first tactical asset, muster roll, and incident management platform designed for field units, disaster relief crews, and cadet contingents operating in zero/unreliable cellular environments.

---

## ⚡ Key Highlights

- **Offline-First PWA (Frontend)**: Local persistence via IndexedDB, immediate reactivity, and peer-to-peer sync over local Wi-Fi Direct or Bluetooth mesh networks.
- **CRDT Sync Engine (Backend)**: Hybrid Logical Clock (HLC) and Last-Write-Wins (LWW) conflict resolution with deterministic tie-breaking.
- **Tactical Modules**:
  - 📡 **Asset & Deployment Lifecycle**: Serialized equipment tracking, condition status, and active deployment validation.
  - 📋 **Personnel & Muster Roll Calls**: Unit rosters, callsigns, ranks, and live check-in tracking (`PRESENT`, `ABSENT`, `INJURED`, `ON_MISSION`).
  - ✅ **Dynamic Checklists**: Pre-mission briefings, inspections, and debrief checklists with step completion tracking.
  - 🚨 **Incident Reporting**: Real-time severity classification (`SEV1` to `SEV5`) with asset and personnel tagging.
  - 🔁 **Mesh Sync & Recovery**: Push/pull delta synchronization and fresh device bootstrap snapshotting.

---

## 📂 Project Structure

```
├── public/                 # PWA icons, assets, and service worker manifests
├── src/                    # Offline-first PWA frontend (Vite, IndexedDB, UI)
│   ├── components/         # Tactical UI components
│   ├── db/                 # Local IndexedDB & client CRDT stores
│   └── utils/              # Client mesh & P2P networking utilities
├── backend/                # Fastify + TypeScript + PostgreSQL + Prisma backend
│   ├── prisma/             # Schema definitions and tactical seed data
│   ├── src/
│   │   ├── crdt/           # Hybrid Logical Clock (HLC) & Conflict Resolver
│   │   ├── services/       # Auth, Assets, Personnel, RollCalls, Incidents, Sync
│   │   ├── routes/         # REST & OpenAPI endpoints (/api/v1/)
│   │   └── __tests__/      # Vitest test suite for HLC & CRDT sync
│   └── README.md           # Backend-specific architecture & API reference
├── package.json            # Root frontend configuration
└── vite.config.js          # Vite bundler configuration
```

---

## 🚀 Getting Started

### 1. Frontend Setup
```bash
npm install
npm run dev
```
Access the client at `http://localhost:5173`.

### 2. Backend Setup
```bash
cd backend
npm install

# Copy environment variables
cp .env.example .env

# Generate Prisma Client & push schema to PostgreSQL
npm run db:generate
npm run db:push

# Seed tactical demo data
npm run db:seed

# Start backend server
npm run dev
```
Backend API will be running at `http://localhost:3001` with Swagger docs at `http://localhost:3001/docs`.

### 3. Run Test Suite
```bash
cd backend
npm test
```

---

## 📜 License
MIT License
