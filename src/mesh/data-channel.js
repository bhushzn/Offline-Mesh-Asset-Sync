/**
 * Data Channel Message Protocol
 * 
 * Defines message types and serialization for WebRTC DataChannel communication.
 * Handles message chunking for payloads exceeding the DataChannel size limit.
 */

/**
 * Message types used in the sync protocol.
 */
export const MessageType = {
  // Sync protocol
  SYNC_REQUEST: 'SYNC_REQUEST',        // "send me changes since HLC X"
  SYNC_RESPONSE: 'SYNC_RESPONSE',      // delta payload of CRDT states
  FULL_STATE_REQUEST: 'FULL_STATE_REQ', // "send me everything"
  FULL_STATE_RESPONSE: 'FULL_STATE',    // complete state dump
  
  // Mesh management
  SIGNAL_RELAY: 'SIGNAL_RELAY',         // forwarded signaling data
  PEER_LIST: 'PEER_LIST',              // share known peer list
  
  // System
  IDENTITY: 'IDENTITY',
  HEARTBEAT: 'HEARTBEAT',
  HEARTBEAT_ACK: 'HEARTBEAT_ACK',
  
  // Chunking
  CHUNK_START: 'CHUNK_START',
  CHUNK_DATA: 'CHUNK_DATA',
  CHUNK_END: 'CHUNK_END',
};

const MAX_CHUNK_SIZE = 14000; // ~14KB per chunk, under the 16KB DataChannel limit

/**
 * Create a sync request message asking for changes since a given timestamp.
 */
export function createSyncRequest(collections, sinceTimestamps) {
  return {
    type: MessageType.SYNC_REQUEST,
    collections,      // array of collection names
    since: sinceTimestamps, // { collectionName: hlcTimestamp }
    requestedAt: Date.now(),
  };
}

/**
 * Create a sync response with CRDT deltas for requested collections.
 */
export function createSyncResponse(deltas) {
  return {
    type: MessageType.SYNC_RESPONSE,
    deltas,  // { collectionName: serializedCRDTDelta }
    sentAt: Date.now(),
  };
}

/**
 * Create a full state response with complete CRDT states.
 */
export function createFullStateResponse(states) {
  return {
    type: MessageType.FULL_STATE_RESPONSE,
    states,  // { collectionName: serializedCRDTState }
    sentAt: Date.now(),
  };
}

/**
 * Create a peer list message sharing known peers.
 */
export function createPeerListMessage(peers) {
  return {
    type: MessageType.PEER_LIST,
    peers,  // array of { peerId, callsign }
  };
}

/**
 * Split a large message into chunks for transmission.
 * Returns an array of chunk messages.
 */
export function chunkMessage(message) {
  const serialized = JSON.stringify(message);
  if (serialized.length <= MAX_CHUNK_SIZE) {
    return [message]; // No chunking needed
  }

  const chunkId = `chunk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const totalChunks = Math.ceil(serialized.length / MAX_CHUNK_SIZE);
  const chunks = [];

  chunks.push({
    type: MessageType.CHUNK_START,
    chunkId,
    totalChunks,
    originalType: message.type,
  });

  for (let i = 0; i < totalChunks; i++) {
    chunks.push({
      type: MessageType.CHUNK_DATA,
      chunkId,
      index: i,
      data: serialized.slice(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE),
    });
  }

  chunks.push({
    type: MessageType.CHUNK_END,
    chunkId,
  });

  return chunks;
}

/**
 * Reassemble chunks into the original message.
 * Call this class to accumulate chunks and get the complete message.
 */
export class ChunkAssembler {
  constructor() {
    /** @type {Map<string, { totalChunks: number, chunks: Map<number, string>, originalType: string }>} */
    this.pending = new Map();
  }

  /**
   * Process a chunk message. Returns the assembled message if complete, null otherwise.
   */
  processChunk(chunk) {
    switch (chunk.type) {
      case MessageType.CHUNK_START:
        this.pending.set(chunk.chunkId, {
          totalChunks: chunk.totalChunks,
          chunks: new Map(),
          originalType: chunk.originalType,
        });
        return null;

      case MessageType.CHUNK_DATA: {
        const assembly = this.pending.get(chunk.chunkId);
        if (!assembly) return null;
        assembly.chunks.set(chunk.index, chunk.data);
        return null;
      }

      case MessageType.CHUNK_END: {
        const assembly = this.pending.get(chunk.chunkId);
        if (!assembly) return null;
        this.pending.delete(chunk.chunkId);

        // Reassemble
        let serialized = '';
        for (let i = 0; i < assembly.totalChunks; i++) {
          serialized += assembly.chunks.get(i) || '';
        }

        try {
          return JSON.parse(serialized);
        } catch {
          console.error('Failed to reassemble chunked message');
          return null;
        }
      }

      default:
        return null;
    }
  }
}
