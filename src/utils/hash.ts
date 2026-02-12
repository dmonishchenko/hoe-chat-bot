import { createHash } from 'node:crypto';

/**
 * Creates a SHA-256 hash of the input string
 */
export function createContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Compares two hashes for equality
 */
export function hashesEqual(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}
