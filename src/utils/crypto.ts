// ============================================================
// FIELDLINK — Cryptographic Utilities, Hashing & AES-GCM 256
// ============================================================

const activeSessionKeys = new Map<string, CryptoKey>();
const seenNonces = new Set<string>();

/**
 * Deterministic canonical JSON stringification (sorted keys).
 * Ensures identical cryptographic hashes across heterogeneous browsers/engines.
 */
export function canonicalJSON(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJSON).join(',') + ']';
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map(
    key => `${JSON.stringify(key)}:${canonicalJSON((obj as Record<string, unknown>)[key])}`
  );
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes a SHA-256 hex digest for an arbitrary JSON payload.
 */
export async function sha256Hex(data: unknown): Promise<string> {
  const json = canonicalJSON(data);
  const enc = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', enc.encode(json));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Converts ArrayBuffer to Base64.
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 string to ArrayBuffer.
 */
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives an AES-GCM 256-bit encryption key using PBKDF2 from a tactical passphrase.
 */
export async function deriveSessionKey(passphrase: string, salt: string = 'fieldlink-tactical-salt'): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function registerPeerSessionKey(peerDeviceId: string, key: CryptoKey) {
  activeSessionKeys.set(peerDeviceId, key);
}

export function getPeerSessionKey(peerDeviceId: string): CryptoKey | undefined {
  return activeSessionKeys.get(peerDeviceId);
}

export interface EncryptedPayload {
  ciphertext: string; // Base64 encoded ciphertext
  iv: string;         // Base64 encoded 12-byte IV
  nonce: string;
  isEncrypted: true;
}

/**
 * Encrypts an arbitrary object using AES-GCM 256.
 */
export async function encryptMeshPayload(
  data: unknown,
  keyOrPassphrase?: CryptoKey | string,
): Promise<EncryptedPayload> {
  let key: CryptoKey;
  if (!keyOrPassphrase || typeof keyOrPassphrase === 'string') {
    const pass = typeof keyOrPassphrase === 'string' ? keyOrPassphrase : 'fieldlink-tactical-session-default';
    key = await deriveSessionKey(pass);
  } else {
    key = keyOrPassphrase;
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const enc = new TextEncoder();
  const encodedData = enc.encode(canonicalJSON(data));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData,
  );

  return {
    ciphertext: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv.buffer),
    nonce,
    isEncrypted: true,
  };
}

/**
 * Decrypts an encrypted mesh payload with replay validation.
 */
export async function decryptMeshPayload<T = unknown>(
  payload: EncryptedPayload,
  keyOrPassphrase?: CryptoKey | string,
): Promise<T> {
  // Replay Protection
  if (payload.nonce) {
    if (seenNonces.has(payload.nonce)) {
      throw new Error(`[Security] Replay attack detected: Nonce ${payload.nonce} already processed`);
    }
    seenNonces.add(payload.nonce);
    if (seenNonces.size > 2000) {
      const first = seenNonces.values().next().value;
      if (first) seenNonces.delete(first);
    }
  }

  let key: CryptoKey;
  if (!keyOrPassphrase || typeof keyOrPassphrase === 'string') {
    const pass = typeof keyOrPassphrase === 'string' ? keyOrPassphrase : 'fieldlink-tactical-session-default';
    key = await deriveSessionKey(pass);
  } else {
    key = keyOrPassphrase;
  }

  const iv = base64ToBuffer(payload.iv);
  const cipherBuffer = base64ToBuffer(payload.ciphertext);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    cipherBuffer,
  );

  const dec = new TextDecoder();
  const jsonStr = dec.decode(decryptedBuffer);
  return JSON.parse(jsonStr) as T;
}

/**
 * Generates an 8-character tactical pairing code.
 */
export function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const randomBytes = crypto.getRandomValues(new Uint8Array(8));
  for (let i = 0; i < 8; i++) {
    code += chars[randomBytes[i] % chars.length];
    if (i === 3) code += '-';
  }
  return code;
}
