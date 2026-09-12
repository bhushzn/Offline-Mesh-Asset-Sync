/**
 * Time formatting utilities for field-appropriate displays.
 */

/**
 * Format a timestamp to a relative time string (e.g., "2m ago", "3h ago").
 */
export function timeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 0) return 'just now';
  if (diff < 5000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

/**
 * Format a timestamp to a military-style date-time group (DTG).
 * Format: DDHHmm'L' MMM YY (e.g., "041530L SEP 26")
 */
export function toDTG(timestamp) {
  const d = new Date(timestamp);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const mon = months[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}${hh}${mm}L ${mon} ${yy}`;
}

/**
 * Format a timestamp to a compact time string (HH:MM).
 */
export function toTime(timestamp) {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Format a timestamp to a short date (DD MMM).
 */
export function toShortDate(timestamp) {
  const d = new Date(timestamp);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}
