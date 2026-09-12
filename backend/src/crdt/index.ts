export { compareHLC, hlcToString, hlcFromString, hlcZero, hlcNow, hlcMax } from './hlc.js';
export type { HLCTimestamp } from './hlc.js';
export { resolveConflict, detectConflict } from './conflictResolver.js';
export type { SyncOp, ConflictRecord } from './conflictResolver.js';
