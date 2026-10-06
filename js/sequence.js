/**
 * Plays items one at a time: each `playOne` must finish before the next starts.
 * @template T
 * @param {T[]} items
 * @param {(item: T) => Promise<void>} playOne
 * @param {AbortSignal} [signal]
 * @returns {Promise<boolean>} true if every item played, false if aborted first
 */
export async function playSequence(items, playOne, signal) {
  for (const item of items) {
    if (signal?.aborted) return false;
    await playOne(item);
  }
  return !signal?.aborted;
}
