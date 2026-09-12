# 🛡️ TacSync Backend — Tactical Mesh & Cloud Sync Engine

Production-grade Fastify + TypeScript + PostgreSQL + Prisma backend for **Zero-Bandwidth Tactical Asset & Checklist Sync via Mesh Networking**.

Designed for field units, disaster-relief crews, and cadet contingents operating in areas with unreliable or zero cellular/internet connectivity.

---

## 🚀 Architecture Highlights

- **CRDT / HLC Sync Engine**: Hybrid Logical Clock (`hlc.ts`) and Last-Write-Wins (LWW) conflict resolution (`conflictResolver.ts`) with deterministic tiebreakers.
- **Offline Idempotency**: Operation logs (`SyncOperation`) ensure that replayed or out-of-order operations from mesh sync peers are processed exactly once.
- **Tactical Domain Services**:
  - **Asset & Deployment Lifecycle**: Tracking serialized equipment, condition transitions, and unit deployments.
  - **Personnel & Roll Call Tracking**: Real-time muster roll call states (`PRESENT`, `ABSENT`, `INJURED`, `ON_MISSION`).
  - **Checklists**: Dynamic tactical checklist templates and execution instances.
  - **Incident Reporting**: Real-time triage with severity scaling (`SEV1` to `SEV5`) and asset/personnel cross-referencing.
  - **Device Registry & Mesh Heartbeats**: Device fingerprinting and peer synchronization session telemetry.
  - **Immutable Audit Logging**: Every mutation, sync merge, and conflict resolution is recorded.

---

## 📡 API Endpoints Overview

| Area | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/register` | Register new tactical operator |
| | `POST` | `/api/v1/auth/login` | Authenticate & get JWT + Refresh token |
| | `POST` | `/api/v1/auth/refresh` | Rotate access token |
| | `GET` | `/api/v1/auth/me` | Current operator profile |
| **Sync** | `POST` | `/api/v1/sync` | **Core Bidirectional CRDT Sync (Push & Pull)** |
| | `GET` | `/api/v1/sync/snapshot` | Full unit state snapshot for fresh device bootstrap |
| | `GET` | `/api/v1/sync/status/:deviceId` | Device sync telemetry & pending queue status |
| | `GET` | `/api/v1/sync/history/:deviceId` | Historical sync sessions |
| **Assets** | `GET` | `/api/v1/assets` | Filtered asset list (status, category, unit) |
| | `POST` | `/api/v1/assets` | Create new equipment record |
| | `POST` | `/api/v1/assets/:id/deploy` | Deploy equipment to personnel |
| | `PATCH`| `/api/v1/assets/deployments/:id` | Return or transfer deployed equipment |
| **Personnel**| `GET` | `/api/v1/personnel` | Roster with rank, callsign, and unit |
| | `POST` | `/api/v1/personnel` | Add operator |
| **Roll Calls**| `GET`| `/api/v1/rollcalls` | Muster roll sessions |
| | `POST` | `/api/v1/rollcalls` | Initiate roll call session with entries |
| | `POST` | `/api/v1/rollcalls/:id/entries` | Record muster status for personnel |
| **Checklists**| `GET` | `/api/v1/checklists/templates` | Checklist templates |
| | `POST` | `/api/v1/checklists/records` | Instantiate checklist |
| | `PATCH`| `/api/v1/checklists/records/:id` | Update checklist item checks & status |
| **Incidents**| `GET` | `/api/v1/incidents` | Active tactical incident reports |
| | `POST` | `/api/v1/incidents` | Create incident report with linked assets/personnel |
| **Health** | `GET` | `/health` | Liveness probe |
| | `GET` | `/health/ready` | Readiness probe with PostgreSQL ping |
| | `GET` | `/api/v1/stats` | Tactical summary metrics dashboard |
| **Docs** | `GET` | `/docs` | Interactive Swagger / OpenAPI UI |

---

## 🛠️ Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and configure your PostgreSQL connection string:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tacsync?schema=public"
```

### 3. Generate Prisma Client & Migrate
```bash
npm run db:generate
npm run db:push
```

### 4. Seed Database (Demo Tactical Data)
```bash
npm run db:seed
```

### 5. Run Server
```bash
npm run dev
```
Server will be available at `http://localhost:3001` (Interactive docs at `http://localhost:3001/docs`).

### 6. Run Unit & CRDT Tests
```bash
npm test
```
