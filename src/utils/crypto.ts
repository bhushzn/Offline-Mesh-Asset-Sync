// ============================================================
// FIELDLINK — Tactical End-to-End Mesh Encryption (AES-GCM 256)
// ============================================================

const DEFAULT_TACTICAL_KEY = 'TACSYNC-CLASSIFIED-MESH-KEY-2026';

/**
 * Derives a 256-bit AES-GCM CryptoKey from a tactical pre-shared passphrase.
 */
async function deriveKey(passphrase: string = DEFAULT_TACTICAL_KEY): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('tacsync-mesh-salt-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedPayload {
  ciphertext: string; // Base64 encoded ciphertext
  iv: string;         // Base64 encoded 12-byte IV
  isEncrypted: true;
}

/**
 * Encrypts an arbitrary object using AES-GCM.
 */
export async function encryptMeshPayload(
  data: unknown,
  passphrase?: string,
): Promise<EncryptedPayload> {
  const key = await deriveKey(passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(data));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData,
  );

  return {
    ciphertext: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv.buffer),
    isEncrypted: true,
  };
}

/**
 * Decrypts an encrypted mesh payload back to original object.
 */
export async function decryptMeshPayload<T = unknown>(
  payload: EncryptedPayload,
  passphrase?: string,
): Promise<T> {
  const key = await deriveKey(passphrase);
  const iv = base64ToBuffer(payload.iv);
  const cipherBuffer = base64ToBuffer(payload.ciphertext);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    cipherBuffer,
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBuffer)) as T;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
