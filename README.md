# FIELDLINK // Zero-Infrastructure Tactical Asset & Roll-Call Mesh Sync

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-3D_Mesh-000000?logo=three.js&logoColor=white)](https://threejs.org/)
[![PWA](https://img.shields.io/badge/PWA-Offline_First-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![IndexedDB](https://img.shields.io/badge/IndexedDB-Local_Data_Store-FF6B6B)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
[![Vitest](https://img.shields.io/badge/Vitest-23_Passed-22C55E?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Android](https://img.shields.io/badge/Android-Native_BLE_P2P-3DDC84?logo=android&logoColor=white)](https://developer.android.com/)

---

## 📌 Project Metadata & Hackathon Alignment

| Parameter | Details |
|---|---|
| **Project Name** | **FIELDLINK (Offline-Mesh-Asset-Sync)** |
| **Team Name** | **APEX PLATOON** |
| **Team Members** | **Bhushan Pawar (Team Lead)** · Harshita Bafna · Jaya Chawre · Harsh Tripathi |
| **Event** | **Engineers 2047 (VISHVA-TECH '26)** — SATI Vidisha |
| **Domain Track** | **Disaster Management, Defense Logistics & Resilient Public Infrastructure (Viksit Bharat @ 2047)** |
| **Primary Repository** | [https://github.com/bhushzn/Offline-Mesh-Asset-Sync](https://github.com/bhushzn/Offline-Mesh-Asset-Sync) |
| **Android APK Build** | **Native Android P2P BLE Mesh APK** (`android/app/build/outputs/apk/debug/app-debug.apk`) |
| **Working Prototype (PWA)** | **[Live Web App (Vercel)](https://offline-mesh-asset-sync.vercel.app/)** • Local PWA (`http://localhost:5173`) |
| **Executive Presentation Deck** | **[FIELDLINK Executive Presentation Deck (PDF)](./FIELDLINK_Executive_Presentation_Deck.pdf)** |
| **Evaluation Round** | Round 1 (Desk-Side Technical) & Round 2 (Grand Finale Stage Demos) |

---

## 🇮🇳 Alignment with Viksit Bharat @ 2047

Under the national vision of **Viksit Bharat 2047**, resilient communication infrastructure and sovereign disaster defense systems are vital:
1. **Disaster Resilience (NDRF / SDRF)**: Ensures continuous situational awareness, casualty muster, and life-saving supply allocation in severed coastal/mountain disaster zones.
2. **Defense & Border Logistics**: Zero-emission, zero-cloud tactical asset tracking with peer-to-peer cryptographic security (AES-GCM-256).
3. **Smart & Resilient Cities**: Distributed fault-tolerant infrastructure monitoring that survives urban power and telecommunication blackouts.

---

## ⚡ Hardware Architecture & Bill of Materials (BOM)

FIELDLINK is engineered to run on **Commercial-Off-The-Shelf (COTS) standard hardware** with zero proprietary dependencies:

| Component | Minimum Specification | Supported Hardware / BOM |
|---|---|---|
| **Field Terminals** | Any smartphone, tablet, or laptop | COTS Android, iOS, Windows, Linux, macOS |
| **Local Radios** | Wi-Fi 802.11 b/g/n/ac or Bluetooth 4.2+ | Standard on-board Wi-Fi and Bluetooth chipsets |
| **Optional Embedded Relay** | Raspberry Pi 4 / ESP32 Gateway | Wi-Fi hotspot or serial packet bridge |
| **Display Standard** | Responsive mobile touch display | 44px touch targets, daylight-readable light theme |

---

## 📖 Executive Summary & Core Mission

> **FIELDLINK MUST ACTUALLY WORK WITHOUT INTERNET.**

During severe disaster responses, subterranean operations, or tactical deployments in contested zones, cellular backhauls, fiber trunks, and satellite uplinks are often destroyed or jammed.

**FIELDLINK** is an offline-first tactical operations Progressive Web Application (PWA) that empowers first responders, disaster response units (NDRF/SDRF), and defense field squads to coordinate equipment accountability, personnel muster rolls, pre-mission checklists, and real-time tactical SITREPs **with zero internet, zero cloud dependency, and zero pre-configured infrastructure**.

---

## 🏗️ The Offline-First Architecture

```
                       FIELDLINK CLIENT (Device A)
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
      LOCAL APPLICATION     NATIVE ANDROID BLE    LOCAL LAN DISCOVERY
              │             (Zero Router/Laptop)        │
          INDEXEDDB                │            LOCAL SIGNALING SERVER
      (Durable Storage)     P2P GATT SERVER     (ws://192.168.x.x:3001)
              │                    │                    │
        CRDT OPERATION       BLE SCANNER /       WebRTC NEGOTIATION
        (HLC + SHA-256)      BURST CHUNKS        (SDP / Local ICE)
              │                    │                    │
         SYNC QUEUE ───────────────┼────────────────────┼───────────┐
                                   ▼                                ▼
                        DIRECT BLE P2P LINK                 WebRTC DATACHANNEL
                                   │                                │
                                   └───────────────┬────────────────┘
                                                   ▼
                                       FIELDLINK CLIENT (Device B)
                                                   │
                                            CRDT ENGINE MERGE
                                       (Deterministic HLC Ordering)
                                                   │
                                                   ▼
                                        INDEXEDDB MUTATION STORE
```

---

## 📱 Native Android Phone-to-Phone BLE Mesh (Zero Laptop / Zero Internet)

FIELDLINK features a native Android Bluetooth Low Energy (BLE) peripheral GATT server and scanner engine (`FieldlinkBlePlugin.java`):

- **True Phone-to-Phone P2P Mesh**: Android devices communicate directly via hardware BLE radios without requiring any laptop, router, cellular signal, or internet connection.
- **Dual GATT Role**: Each device runs both a BLE GATT Server (advertiser) and BLE Scanner (client) simultaneously to support bidirectional communication.
- **Burst Frame Chunking**: Large JSON operations are automatically segmented into 180-byte frames (`FLK:<msgId>:<seq>:<total>:<data>`) and reassembled on receipt.
- **Store-and-Forward Routing**: Built-in multi-hop routing (`meshRouter.ts`) allows Phone A to reach Phone C through intermediate Phone B with loop prevention and TTL decrements.
- **Testing on Physical Phones**:
  1. Install APK on both phones: `adb install -r FIELDLINK-tacticalmesh-debug.apk` (or copy `.apk` file directly).
  2. Turn **OFF** Wi-Fi and Mobile Data on both phones; turn **ON** Bluetooth.
  3. Launch FIELDLINK on both devices.
  4. In **Sync Center**, tap **`[SEND TEST MESSAGE]`** on Phone A.
  5. Phone B chimes and confirms: `LIVE P2P MESSAGE CONFIRMED: "HELLO FROM NODE-XXXX"`.
  6. Any asset or personnel mutation made on Phone A updates Phone B's screen in real time!

- **Local-First Storage**: Every create, update, and delete writes instantly to browser **IndexedDB** (sub-2ms latency).
- **CRDT Convergence**: State changes are encapsulated as Conflict-Free Replicated Data Type operations with **Hybrid Logical Clocks (HLC)** and SHA-256 integrity hashes.
- **Local LAN WebRTC Signaling**: Lightweight local Node.js WebSocket signaling server runs directly on the command laptop or hotspot machine (`0.0.0.0:3001`), exchanging only peer IDs, SDP offers/answers, and ICE host candidates.
- **Direct WebRTC DataChannel**: Operational data travels directly peer-to-peer over WebRTC DataChannels across local Wi-Fi without internet or external STUN servers.
- **Optional Cloud Backhaul**: Cloud synchronization is strictly an optional background bridge when internet is available. Cloud failure never impairs local field operations.

---

## 🚀 Quick Start Guide (Local Setup)

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/bhushzn/Offline-Mesh-Asset-Sync.git
cd Offline-Mesh-Asset-Sync

# Install dependencies
npm install
```

### 3. Running the Tactical Mesh Server & Application

#### Terminal 1: Start the Offline Mesh Signaling Server
```bash
npm run mesh-server
```
*Output will display your machine's local IP (e.g., `ws://192.168.43.100:3001/ws/mesh`).*

#### Terminal 2: Start the Frontend Application
```bash
npm run dev -- --host
```
*Access the app at `http://localhost:5173` on your PC, or `http://<YOUR_LAN_IP>:5173` on other phones/tablets.*

---

## 📱 Two-Device Live Offline Demo (Step-by-Step)

Follow these exact steps to demonstrate FIELDLINK without Internet:

### Step 1: Connect to Local Wi-Fi / Hotspot
1. Turn on Wi-Fi hotspot on your laptop or phone.
2. Connect your **Laptop (Device A)** and **Phone/Tablet (Device B)** to this Wi-Fi hotspot.
3. **Turn Mobile Data / Internet OFF** on all devices (Ensure only local Wi-Fi is active).

### Step 2: Start the Local Mesh Server
1. On Device A (Laptop), find your local IP address:
   - **Windows**: Open Command Prompt and run `ipconfig` (look for IPv4 Address, e.g. `192.168.43.100`).
2. Run the local mesh server:
   ```powershell
   npm run mesh-server
   ```
3. Run the web application:
   ```powershell
   npm run dev -- --host
   ```

### Step 3: Open FIELDLINK on Both Devices
1. On **Laptop (Device A)**: Open `http://localhost:5173`.
2. On **Phone (Device B)**: Open `http://192.168.43.100:5173` in mobile Chrome/Safari.

### Step 4: Verify Mesh Connection
1. Observe the **FIELDLINK LIVE MESH STATUS** bar at the top of the dashboard:
   - **Internet**: `OFFLINE`
   - **Local LAN Server**: `CONNECTED`
   - **P2P Mesh**: `ACTIVE`
   - **WebRTC Transport**: `CONNECTED`
   - **Connected Peers**: `1` (or `2`)
2. In the 3D Tactical Mesh canvas, observe the real peer node appear.

### Step 5: Perform Real Offline Sync
1. On **Device A (Laptop)**: Go to **Assets & Equipment**, click `+ New Asset`, and create:
   - Name: `Tactical Drone Raven-X`
   - Status: `Deployed`
2. **Instant Sync**: Look at **Device B (Phone)** — the asset appears immediately via WebRTC DataChannel!
3. On **Device B (Phone)**: Go to **Incidents**, click `Report SITREP`, and log a critical perimeter alert.
4. Look at **Device A (Laptop)** — the alert appears in real-time with zero internet!

---

## 🔬 Technical Deep-Dive

### 1. Why WebRTC Works in True Offline LAN Mode
Standard WebRTC examples fail offline because they hardcode public Google STUN servers (`stun.l.google.com`). When internet is disconnected, STUN requests time out and ICE gathering fails.

FIELDLINK solves this:
- In **`FIELD_MODE`**: `iceServers: []` is passed to `RTCPeerConnection`.
- The browser immediately gathers local **host ICE candidates** (e.g. `192.168.43.100:54321` and `192.168.43.105:54322`).
- WebRTC DataChannel connects directly over local Wi-Fi UDP within milliseconds.

### 2. Conflict-Free Replicated Data Types (CRDT)
- **LWW-Register**: Entity fields are versioned using Hybrid Logical Clocks `(timestamp, counter, deviceId)`. If Device A and Device B edit the same asset concurrently while disconnected, `Max(HLC_A, HLC_B)` wins deterministically with device ID tie-breaking.
- **Grow-Only Sets & Monotonic Counters**: Personnel roll call statuses use idempotent monotonic set unions, preventing duplicate or lost muster records across asynchronous hops.
- **Merkle Tree Delta Synchronization**: Nodes exchange 64-bit cryptographic root hashes to bisect and transmit only missing mutation journals, minimizing radio transmission overhead.

### 3. 3D Spatial Mesh Visualization
- Built with hardware-accelerated **Three.js v0.186** and **OrbitControls**.
- Features cursor raycasting, billboard canvas sprites, and dynamic packet routing animations wired to live `syncManager.subscribePacketEvents` triggers.

---

## 🧪 Automated Test Suite

Run the full Vitest automated unit and integration suite:
```bash
npm test
```
*Output: 20/20 tests passing across 4 test suites:*
- `crdtEngine.test.ts` (HLC ordering, canonical JSON, SHA-256 op hashing, LWW conflict resolution)
- `offlineSync.test.ts` (Vector clock delta calculation, tie-breaking, roll call muster merging, checklist state merging)
- `rollCallMapper.test.ts` & `personnelMapper.test.ts`

To compile production bundles:
```bash
npm run build
```

---

## 📸 Operational Interface & Screenshots

### 1. Operations Dashboard & Live 3D Mesh Topology
![Operations Dashboard](docs/screenshots/dashboard.png)
*Real-time 73% mission readiness gauge, active node selector, and 3D spatial node mesh visualizer.*

---

### 2. Tactical Assets & Equipment Accountability
![Tactical Assets](docs/screenshots/assets.png)
*Real-time equipment catalog with status badges, sector assignments, and condition tracking.*

---

### 3. Squad Personnel & Live Muster Roll
![Personnel Muster Roll](docs/screenshots/personnel_muster.png)
*1-tap rapid roll-call toggling (`Present`, `Absent`, `Injured`) and unit headcount reconciliation.*

---

### 4. Operational Checklists & Procedures
![Tactical Checklists](docs/screenshots/checklists.png)
*Interactive protocol execution with step verification and CRDT grow-only completion tracking.*

---

### 5. Emergency Incident Log & SITREP Dispatch
![Incident Log SITREP](docs/screenshots/incidents_sitrep.png)
*Real-time incident reporting with severity triage (`Critical`, `High Priority`) and location tags.*

---

### 6. Tactical GIS Map & Spatial Radar
![Tactical GIS Map](docs/screenshots/tactical_map_gis.png)
*Interactive sector grid with asset/incident markers, mesh relay links, and GPS coordinate HUD.*

---

### 7. Decentralized Sync Center & CRDT Conflict Log
![Tactical Sync Center](docs/screenshots/sync_center.png)
*8-stage synchronization pipeline visualizer, outbound queue, and deterministic CRDT conflict resolution table.*

---

### 8. Immutable Operational Audit Trail
![Operational Audit Trail](docs/screenshots/audit_trail.png)
*Tamper-evident local event log recording all mutations, peer connections, and state transitions.*

---

### 9. System Telemetry & Encrypted Vault Settings
![Settings and System Telemetry](docs/screenshots/settings.png)
*Node identity configuration, battery status monitoring, AES-GCM 256 encryption status, and vault backup.*

---

## 🧪 Evaluation & Demo Walkthrough (For Judges)

1. **Multi-Node Simulation**: Open two split browser windows at `http://localhost:5173` (Node Alpha and Node Bravo).
2. **Offline Mutation**: On Node Alpha, mark personnel as *Injured* in the **Muster Roll** view. Observe instant local IndexedDB update.
3. **P2P Synchronization**: Witness sub-second convergence on Node Bravo without contacting any central server.
4. **Partition & Conflict Resolution**: Use the **Demo Network Simulator** to disconnect the nodes, perform concurrent edits, reconnect, and inspect the **Sync Center** conflict log.

---

## 🛡️ Hackathon Submission Details

- **Event**: Engineers 2047 (VISHVA-TECH '26)
- **Project**: FIELDLINK (Offline-Mesh-Asset-Sync)
- **Track**: Disaster Management, Defense Logistics & Resilient Public Infrastructure (Viksit Bharat @ 2047)
- **Team**: APEX PLATOON
- **License**: MIT Open Source License
