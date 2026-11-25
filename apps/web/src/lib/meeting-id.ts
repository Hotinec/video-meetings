/** Largest value of the API's Postgres Int column; anything above would be a 500, not a 404. */
const MAX_ID = 2147483647;

/** Parses a route segment into a meeting id, or null if it can't be one. */
export function parseMeetingId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return id <= MAX_ID ? id : null;
}
