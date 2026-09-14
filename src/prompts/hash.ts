/**
 * Stable 32-bit hash for deterministic prompt index selection.
 */
export function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pickIndex(seed: string, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return hashSeed(seed) % length;
}
