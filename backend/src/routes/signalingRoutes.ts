// ============================================================
// TacSync Backend — Tactical Mesh WebSocket Signaling Gateway
// ============================================================

import { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';

interface ConnectedPeer {
  deviceId: string;
  deviceName?: string;
  role?: string;
  socket: WebSocket;
  connectedAt: Date;
}

const activePeers = new Map<string, ConnectedPeer>();

export async function signalingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/mesh', { websocket: true }, (socket, req) => {
    let currentDeviceId: string | null = null;

    socket.on('message', (rawMessage: any) => {
      try {
        const payload = JSON.parse(rawMessage.toString());

        switch (payload.action) {
          case 'REGISTER_DEVICE': {
            currentDeviceId = payload.deviceId;
            activePeers.set(payload.deviceId, {
              deviceId: payload.deviceId,
              deviceName: payload.deviceName,
              role: payload.role,
              socket,
              connectedAt: new Date(),
            });

            // Broadcast peer online to others
            broadcast(
              {
                action: 'PEER_JOINED',
                deviceId: payload.deviceId,
                deviceName: payload.deviceName,
                role: payload.role,
              },
              payload.deviceId,
            );
            break;
          }

          case 'BROADCAST_PACKET': {
            // Forward mesh packet to all other connected peers
            if (payload.message) {
              broadcast(
                {
                  action: 'MESH_PACKET',
                  fromDeviceId: currentDeviceId,
                  message: payload.message,
                },
                currentDeviceId || '',
              );
            }
            break;
          }

          case 'DIRECT_SIGNAL': {
            // Forward WebRTC signal (SDP/ICE) to target device
            const targetPeer = activePeers.get(payload.targetDeviceId);
            if (targetPeer && targetPeer.socket.readyState === 1) {
              targetPeer.socket.send(
                JSON.stringify({
                  action: 'WEBRTC_SIGNAL',
                  fromDeviceId: currentDeviceId,
                  signal: payload.signal,
                }),
              );
            }
            break;
          }
        }
      } catch (err) {
        req.log.warn({ err }, 'Error processing WebSocket message');
      }
    });

    socket.on('close', () => {
      if (currentDeviceId) {
        activePeers.delete(currentDeviceId);
        broadcast({ action: 'PEER_LEFT', deviceId: currentDeviceId }, currentDeviceId);
      }
    });
  });

  // REST endpoint to list currently connected WebSocket peers
  fastify.get('/peers', async (_req, reply) => {
    const list = Array.from(activePeers.values()).map((p) => ({
      deviceId: p.deviceId,
      deviceName: p.deviceName,
      role: p.role,
      connectedAt: p.connectedAt,
    }));
    return reply.send({ success: true, count: list.length, data: list });
  });
}

function broadcast(data: Record<string, unknown>, senderDeviceId: string) {
  const messageStr = JSON.stringify(data);
  for (const [id, peer] of activePeers.entries()) {
    if (id !== senderDeviceId && peer.socket.readyState === 1) {
      try {
        peer.socket.send(messageStr);
      } catch {
        // Socket error, skip
      }
    }
  }
}
