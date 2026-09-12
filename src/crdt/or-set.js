import { generateId } from '../utils/uuid.js';

/**
 * Observed-Remove Set (OR-Set)
 * 
 * A CRDT set that supports both add and remove operations.
 * Each addition is tagged with a unique identifier. Removals only
 * affect the specific tags that were observed, allowing concurrent
 * adds to survive concurrent removes.
 * 
 * Used for tracking equipment assignments (who has what).
 */
export class ORSet {
  constructor() {
    /** @type {Map<string, Set<string>>} element → set of unique tags */
    this.elements = new Map();
    /** @type {Set<string>} removed tags */
    this.tombstones = new Set();
  }

  /**
   * Add an element to the set with a new unique tag.
   * Returns the generated tag.
   */
  add(element) {
    const tag = generateId();
    const tags = this.elements.get(element) || new Set();
    tags.add(tag);
    this.elements.set(element, tags);
    return tag;
  }

  /**
   * Remove an element by tombstoning all its currently observed tags.
   */
  remove(element) {
    const tags = this.elements.get(element);
    if (tags) {
      for (const tag of tags) {
        this.tombstones.add(tag);
      }
      this.elements.delete(element);
    }
  }

  /**
   * Check if an element is in the set (has at least one non-tombstoned tag).
   */
  has(element) {
    const tags = this.elements.get(element);
    if (!tags) return false;
    for (const tag of tags) {
      if (!this.tombstones.has(tag)) return true;
    }
    return false;
  }

  /**
   * Get all elements currently in the set.
   */
  values() {
    const result = [];
    for (const [element, tags] of this.elements) {
      for (const tag of tags) {
        if (!this.tombstones.has(tag)) {
          result.push(element);
          break;
        }
      }
    }
    return result;
  }

  /**
   * Number of elements in the set.
   */
  get size() {
    return this.values().length;
  }

  /**
   * Merge with a remote OR-Set.
   * - Union of all element-tag pairs
   * - Union of all tombstones
   * - An element is in the set iff it has a tag NOT in the tombstone set
   */
  merge(remote) {
    // Merge tombstones first
    for (const tag of remote.tombstones) {
      this.tombstones.add(tag);
    }

    // Merge element-tag pairs
    for (const [element, remoteTags] of remote.elements) {
      const localTags = this.elements.get(element) || new Set();
      for (const tag of remoteTags) {
        localTags.add(tag);
      }
      this.elements.set(element, localTags);
    }

    // Clean up: remove element entries where all tags are tombstoned
    for (const [element, tags] of this.elements) {
      let hasLive = false;
      for (const tag of tags) {
        if (!this.tombstones.has(tag)) {
          hasLive = true;
          break;
        }
      }
      if (!hasLive) {
        this.elements.delete(element);
      }
    }
  }

  /**
   * Serialize to a plain object.
   */
  toJSON() {
    const elements = {};
    for (const [element, tags] of this.elements) {
      elements[element] = Array.from(tags);
    }
    return {
      elements,
      tombstones: Array.from(this.tombstones),
    };
  }

  /**
   * Deserialize from a plain object.
   */
  static fromJSON(json) {
    const set = new ORSet();
    if (!json) return set;
    if (json.elements) {
      for (const [element, tags] of Object.entries(json.elements)) {
        set.elements.set(element, new Set(tags));
      }
    }
    if (json.tombstones) {
      set.tombstones = new Set(json.tombstones);
    }
    return set;
  }
}
