/**
 * Generate a cryptographically secure UUID v4.
 * Falls back to Math.random if crypto API is not available.
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate a short callsign-style ID for display purposes.
 * Format: ALPHA-XXXX (e.g., BRAVO-3F7A)
 */
const PHONETIC = [
  'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT',
  'GOLF', 'HOTEL', 'INDIA', 'JULIET', 'KILO', 'LIMA',
  'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA', 'QUEBEC', 'ROMEO',
  'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY', 'XRAY',
  'YANKEE', 'ZULU',
];

export function generateCallsign() {
  const word = PHONETIC[Math.floor(Math.random() * PHONETIC.length)];
  const hex = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  return `${word}-${hex}`;
}
