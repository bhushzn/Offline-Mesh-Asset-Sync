# FIELDLINK — Complete Setup & Judge Presentation Master Guide

> **Project**: FIELDLINK (Offline-Mesh-Asset-Sync)  
> **Team**: APEX PLATOON  
> **Track**: Disaster Management, Defense Logistics & Resilient Public Infrastructure (Viksit Bharat @ 2047)  
> **Repository**: [github.com/bhushzn/Offline-Mesh-Asset-Sync](https://github.com/bhushzn/Offline-Mesh-Asset-Sync)  
> **APK File**: `FIELDLINK-tacticalmesh-debug.apk` (Root directory & `android/app/build/outputs/apk/debug/app-debug.apk`)

---

## PART 1: COMPLETE SETUP GUIDE

### Option A: Physical Android Phone-to-Phone Setup (Primary / Grand Finale)
*Use this mode to prove that the application works **with ZERO laptop, ZERO internet, and ZERO Wi-Fi router**.*

#### 1. Requirements
- 2 or more Android phones (Android 8.0 to Android 15+).
- USB cable or file transfer method (WhatsApp, Google Drive, Nearby Share, Pen drive) to copy the APK file.

#### 2. Installing the App on Both Phones
- **Direct Copy**:
  1. Transfer `FIELDLINK-tacticalmesh-debug.apk` from the laptop to **Phone A** and **Phone B**.
  2. On each phone, open your **Files** or **Downloads** app, tap `FIELDLINK-tacticalmesh-debug.apk`, and tap **Install**.
  3. If prompted with *"Install unknown apps"*, toggle **Allow from this source**.
- **Or via USB / ADB**:
  Connect phone via USB with USB Debugging enabled, and run:
  ```powershell
  adb install -r FIELDLINK-tacticalmesh-debug.apk
  ```

#### 3. Preparing Phones for the Demo
1. On **Phone A**:
   - Turn **OFF Wi-Fi**.
   - Turn **OFF Mobile Data**.
   - Turn **ON Bluetooth**.
2. On **Phone B**:
   - Turn **OFF Wi-Fi**.
   - Turn **OFF Mobile Data**.
   - Turn **ON Bluetooth**.
3. Open **FIELDLINK** on both phones.
4. When prompted for **Nearby Devices / Bluetooth permissions**, tap **"Allow"** (or "While using the app").

---

### Option B: Laptop + Phone Local LAN Setup (Desk-Side Technical Round)
*Use this mode when you want to show the **3D Spatial Topology visualizer** on a laptop screen while syncing with a phone.*

#### 1. Prerequisites on Laptop
- Node.js v18+ installed.
- Both laptop and phone connected to the **same Wi-Fi hotspot** (e.g. laptop hotspot or phone hotspot — **Internet can be completely turned OFF**).

#### 2. Starting the Services
1. Open a terminal in the project directory (`tacsync`):
   ```powershell
   # Find your laptop local IP
   ipconfig
   # Look for IPv4 Address (e.g. 192.168.43.100)
   ```
2. **Terminal 1** — Start the offline local signaling server:
   ```powershell
   npm run mesh-server
   ```
3. **Terminal 2** — Start the Vite frontend:
   ```powershell
   npm run dev -- --host
   ```
4. **On Laptop**: Open Chrome/Edge at `http://localhost:5173`.
5. **On Phone**: Open mobile Chrome at `http://192.168.43.100:5173` (replace with your laptop IP).

---

## PART 2: 3-MINUTE HACKATHON WINNING PRESENTATION SCRIPT

### ⏱️ Minute 0:00 – 0:45 | The Hook & The Critical Problem
> *"Good morning, respected judges. Imagine a catastrophic coastal cyclone or a high-altitude border landslide. Cell towers collapse, fiber cables snap, and cloud servers are completely unreachable.*  
> 
> *Current emergency response apps fail the exact second the internet cuts out because they depend on centralized cloud databases.*  
> 
> *Under the national vision of **Viksit Bharat 2047**, India needs sovereign, zero-infrastructure disaster resilience. That is why our team, APEX PLATOON, built **FIELDLINK**.*  
> 
> ***FIELDLINK MUST ACTUALLY WORK WITHOUT INTERNET.***  
> *It runs directly on commercial off-the-shelf Android smartphones, communicating peer-to-peer using Bluetooth Low Energy (BLE) and decentralized CRDT math — requiring ZERO laptop, ZERO cellular towers, ZERO internet, and ZERO external servers."*

---

### ⏱️ Minute 0:45 – 2:00 | The Live Phone-to-Phone Field Demo (High Impact!)

*(Hold up **Phone A** in your left hand and **Phone B** in your right hand. Turn on the screens so the judges can see).*

#### Action 1: Prove Total Air-Gap Isolation
> *"Judges, look at both of these phones. As you can see, **Mobile Data is OFF**, and **Wi-Fi is OFF**. There is no SIM connection, no router, and no laptop relaying packets. Only native Bluetooth is active."*

#### Action 2: Direct P2P Ping / Test Message (Phase 4 Proof)
1. Open the **Sync Center** view on both phones.
2. Point to the screen:
   > *"Both devices are running our custom native Android BLE engine. Phone A is acting as a BLE GATT Server, and Phone B is simultaneously scanning and connected."*
3. On **Phone A**, tap **`[SEND TEST MESSAGE]`**.
4. **Phone B will chime and immediately display**:
   `LIVE P2P MESSAGE CONFIRMED: "HELLO FROM NODE-XXXX"`
5. Point to the packet log on Phone B:
   > *"Within 80 milliseconds, over direct radio waves, Phone B received and authenticated the P2P frame!"*

#### Action 3: Real Tactical Asset & Muster Roll Synchronization
1. On **Phone A**, navigate to **Assets & Equipment**.
2. Tap **`[+ DEPLOY NEW ASSET]`** (or edit an existing one like `Tactical Drone Raven-X`).
3. Set status to **`Deployed`** in **`Sector Delta`**, and tap **Save**.
4. Show Phone B to the judges:
   > *"Look at Phone B's screen: without refreshing, without internet, and without any cloud server, the asset has instantly synced to 'Deployed'!"*
5. Show the **Sync Center** on Phone A:
   > *"The operation was cryptographically hashed with SHA-256, stamped with a Hybrid Logical Clock, and the queue displays 'SYNCED' upon receiving an automated cryptographic ACK from Phone B."*

---

### ⏱️ Minute 2:00 – 2:30 | Technical Architecture & Innovation Highlights
> *"How does FIELDLINK achieve this?*  
> 
> 1. ***Custom Native BLE GATT Server & Scanner***: Standard mobile frameworks only support BLE client mode. We wrote a custom native Java plugin (`FieldlinkBlePlugin.java`) that turns every Android phone into an advertising GATT server and central client at the same time.  
> 2. ***Burst Frame Chunking***: BLE standard MTU is small. We engineered an autonomous framing protocol that slices arbitrary CRDT mutations into 180-byte burst frames with automatic reassembly.  
> 3. ***Deterministic CRDT Conflict Resolution***: We use Hybrid Logical Clocks (HLC) and Last-Write-Wins registers. If two rescue teams edit the same supply box simultaneously while out of range, the system converges deterministically the moment they come back into proximity.  
> 4. ***Multi-Hop Store-and-Forward Routing***: If Phone A is out of range of Phone C, Phone B automatically acts as a store-and-forward relay node with hop counts, TTL decay, and duplicate packet suppression."*

---

### ⏱️ Minute 2:30 – 3:00 | Viksit Bharat 2047 Impact & Conclusion
> *"FIELDLINK doesn't require multi-million-rupee proprietary defense hardware. It runs on any ₹8,000 Android smartphone in a jawan's or NDRF rescuer's pocket.*  
> 
> *All 23 automated tests are passing, the APK is compiled, and the system is ready for field deployment today.*  
> 
> *Thank you. We are now open for your technical questions."*

---

## PART 3: HOW TO ANSWER TOUGH JUDGE QUESTIONS

### Q1: "What happens if two rescuers update the same asset with conflicting information while disconnected?"
**Answer**:
> *"We use state-based Conflict-Free Replicated Data Types (CRDT) powered by Hybrid Logical Clocks (HLC). Every mutation bundles physical wall-clock time, a monotonic logical counter, and the physical node's unique UUID.*  
> 
> *When nodes reconnect, our CRDT engine compares `(timestamp, counter, deviceId)`. The higher clock wins deterministically, and our `syncManager` automatically logs the conflict and winning rationale to the tamper-evident Conflict Resolution Log in the Sync Center."*

---

### Q2: "BLE packets have small MTU (23 to 512 bytes). How do you sync complex records?"
**Answer**:
> *"Standard BLE packets without negotiation are limited to ~20 bytes of payload. We solved this in two ways:*  
> 1. *Our native plugin requests an MTU increase up to 517 bytes immediately on GATT connection.*  
> 2. *We built an autonomous burst framing protocol: payloads are sliced into `FLK:<msgId>:<sequence>:<total>:<chunkData>` chunks of 180 bytes. The receiving node's background buffer reassembles the complete payload once all sequence numbers arrive, ignoring duplicates."*

---

### Q3: "What if Phone A and Phone C are too far apart to connect over Bluetooth?"
**Answer**:
> *"That's where our Store-and-Forward Mesh Routing (`meshRouter.ts`) comes in. When Phone B walks between Phone A and Phone C, Phone B receives the packet, recognizes it is not the final destination, decrements the TTL, appends itself to the routing path, and re-broadcasts the packet over BLE. Phone C then receives the packet with complete origin integrity."*

---

### Q4: "Does this drain phone battery in the field?"
**Answer**:
> *"No. Unlike Wi-Fi which requires high transmission power (200-500mW), Bluetooth Low Energy operates in short microsecond bursts drawing less than 15mW. Furthermore, we use adaptive beaconing: discovery beacons transmit every 15 seconds, and radio activity sleeps between mutation triggers."*

---

### Q5: "Is the data secure against eavesdropping or rogue nodes?"
**Answer**:
> *"Yes. All payloads exchanged across the mesh are encrypted using AES-GCM-256 with SHA-256 message digests (`encryptMeshPayload`). Only authorized nodes possessing the field network pre-shared key can decrypt and merge operations."*
