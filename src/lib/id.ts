/** Stable unique id used across the data layer (replaces db.newId in WS1.3). */
export function newId(): string {
  return crypto.randomUUID();
}
