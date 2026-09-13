/**
 * ============================================================
 * FIELDLINK — Offline Local LAN Mesh Signaling Server
 * ============================================================
 * 
 * Purpose:
 * - Runs completely offline without internet on a local laptop / hotspot / Pi.
 * - Listens on 0.0.0.0 on configurable port (default 3001).
 * - Provides lightweight local peer discovery and WebRTC signaling (SDP & ICE).
 * - Does NOT store operational data.
 * - Does NOT depend on cloud, Firebase, or external STUN servers.
 */

import http from 'node:http';
import os from 'node:os';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '0.0.0.0';

// Map of active connected peers: deviceId -> { deviceId, deviceName, role, ws, connectedAt }
const activePeers = new Map();

// Helper: Get local LAN IP addresses
function getLocalIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const ifaceName of Object.keys(interfaces)) {
    const list = interfaces[ifaceName];
    if (!list) continue;
    for (const iface of list) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

// Create HTTP server for health checks & peer listing
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/health' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ONLINE',
      service: 'FIELDLINK-LOCAL-SIGNALING',
      version: '2.0.0',
      connectedPeers: activePeers.size,
      uptimeSec: Math.floor(process.uptime()),
      timestamp: Date.now()
    }));
    return;
  }

  if (req.url === '/api/peers' || req.url === '/peers') {
    const list = Array.from(activePeers.values()).map(p => ({
      deviceId: p.deviceId,
      deviceName: p.deviceName,
      role: p.role,
      connectedAt: p.connectedAt
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: list.length, peers: list }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`FIELDLINK Local Tactical Mesh Signaling Server Active\nPath: ws://<IP>:${PORT}/ws/mesh\n`);
});

// Create WebSocket Server attached to HTTP Server
const wss = new WebSocketServer({ server });

function broadcastToOthers(senderDeviceId, messageObj) {
  const raw = JSON.stringify(messageObj);
  for (const [deviceId, peer] of activePeers.entries()) {
    if (deviceId !== senderDeviceId && peer.ws.readyState === WebSocket.OPEN) {
      try {
        peer.ws.send(raw);
      } catch (err) {
        console.warn(`[Signaling] Broadcast error to ${deviceId}:`, err.message);
      }
    }
  }
}

function sendToPeer(targetDeviceId, messageObj) {
  const peer = activePeers.get(targetDeviceId);
  if (peer && peer.ws.readyState === WebSocket.OPEN) {
    try {
      peer.ws.send(JSON.stringify(messageObj));
      return true;
    } catch (err) {
      console.warn(`[Signaling] Direct send error to ${targetDeviceId}:`, err.message);
      return false;
    }
  }
  return false;
}

wss.on('connection', (ws, req) => {
  let registeredDeviceId = null;
  const clientIp = req.socket.remoteAddress;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const action = msg.action || msg.type;

      switch (action) {
        // Peer registration
        case 'REGISTER':
        case 'REGISTER_DEVICE': {
          const deviceId = msg.deviceId || msg.senderDeviceId;
          if (!deviceId) return;

          registeredDeviceId = deviceId;
          const deviceName = msg.deviceName || `Node-${deviceId.slice(0, 5)}`;
          const role = msg.role || 'Field Operator';

          activePeers.set(deviceId, {
            deviceId,
            deviceName,
            role,
            ws,
            connectedAt: Date.now()
          });

          console.log(`[+] Peer Registered: ${deviceId} (${deviceName}) from ${clientIp}`);

          // 1. Send confirmation with current active peers list back to registrant
          const existingPeers = Array.from(activePeers.values())
            .filter(p => p.deviceId !== deviceId)
            .map(p => ({ deviceId: p.deviceId, deviceName: p.deviceName, role: p.role }));

          ws.send(JSON.stringify({
            action: 'REGISTERED',
            deviceId,
            activePeers: existingPeers,
            serverTimestamp: Date.now()
          }));

          // 2. Notify all existing peers that a new peer has joined
          broadcastToOthers(deviceId, {
            action: 'PEER_JOINED',
            deviceId,
            deviceName,
            role,
            timestamp: Date.now()
          });
          break;
        }

        // WebRTC Signaling: SDP Offer / Answer / ICE Candidates
        case 'WEBRTC_SIGNAL':
        case 'SIGNAL':
        case 'DIRECT_SIGNAL': {
          const targetDeviceId = msg.targetDeviceId || msg.targetPeerId;
          const fromDeviceId = msg.senderDeviceId || msg.fromDeviceId || registeredDeviceId;

          if (targetDeviceId && fromDeviceId) {
            const forwarded = sendToPeer(targetDeviceId, {
              action: 'WEBRTC_SIGNAL',
              fromDeviceId,
              targetDeviceId,
              signal: msg.signal || msg.__webrtc_signal || msg,
              timestamp: Date.now()
            });

            if (!forwarded) {
              ws.send(JSON.stringify({
                action: 'SIGNAL_FAILED',
                targetDeviceId,
                reason: 'PEER_UNREACHABLE'
              }));
            }
          }
          break;
        }

        // Fallback broadcast message across LAN (e.g. initial HELLO / presence)
        case 'BROADCAST_PACKET':
        case 'HELLO': {
          const fromDeviceId = msg.senderDeviceId || registeredDeviceId;
          broadcastToOthers(fromDeviceId, {
            action: 'MESH_PACKET',
            fromDeviceId,
            message: msg.message || msg,
            timestamp: Date.now()
          });
          break;
        }

        // Ping / Heartbeat
        case 'PING': {
          ws.send(JSON.stringify({ action: 'PONG', timestamp: Date.now() }));
          break;
        }

        default: {
          if (msg.targetDeviceId) {
            sendToPeer(msg.targetDeviceId, msg);
          }
        }
      }
    } catch (err) {
      console.warn('[Signaling] Malformed message received:', err.message);
    }
  });

  ws.on('close', () => {
    if (registeredDeviceId && activePeers.has(registeredDeviceId)) {
      const peerInfo = activePeers.get(registeredDeviceId);
      activePeers.delete(registeredDeviceId);
      console.log(`[-] Peer Disconnected: ${registeredDeviceId} (${peerInfo?.deviceName || 'unknown'})`);

      broadcastToOthers(registeredDeviceId, {
        action: 'PEER_LEFT',
        deviceId: registeredDeviceId,
        timestamp: Date.now()
      });
    }
  });

  ws.on('error', (err) => {
    console.warn(`[Signaling] Socket error on ${registeredDeviceId || 'unknown'}:`, err.message);
  });
});

// Start listening
server.listen(PORT, HOST, () => {
  const localIps = getLocalIPAddresses();
  console.log('============================================================');
  console.log('  FIELDLINK // LOCAL MESH SIGNALING SERVER');
  console.log('  Status: ONLINE (Offline LAN Mode · Zero Cloud Dependency)');
  console.log(`  Port:   ${PORT}`);
  console.log('============================================================');
  console.log('  Connect your devices on the same Wi-Fi / Hotspot:');
  console.log('  ----------------------------------------------------------');
  console.log(`  Localhost (This PC):    ws://localhost:${PORT}/ws/mesh`);
  localIps.forEach(ip => {
    console.log(`  LAN Wi-Fi Address:      ws://${ip}:${PORT}/ws/mesh`);
  });
  console.log('============================================================');
  console.log('  Ready for direct WebRTC peer-to-peer data synchronization.');
  console.log('============================================================\n');
});
