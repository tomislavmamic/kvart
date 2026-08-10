export type HomepageData<Stats, Update> =
  | { available: true; stats: Stats; updates: Update[] }
  | { available: false; stats: null; updates: null };

function hasErrorCode(error: unknown, expected: string): boolean {
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  while (pending.length > 0) {
    const candidate = pending.pop();
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    if (typeof candidate !== "object") continue;
    const record = candidate as {
      code?: unknown;
      cause?: unknown;
      errors?: unknown;
    };
    if (record.code === expected) return true;
    if (record.cause) pending.push(record.cause);
    if (Array.isArray(record.errors)) pending.push(...record.errors);
  }
  return false;
}

export async function loadHomepageData<Stats, Update>(
  loadStats: () => Promise<Stats>,
  loadUpdates: () => Promise<Update[]>,
): Promise<HomepageData<Stats, Update>> {
  try {
    const [stats, updates] = await Promise.all([loadStats(), loadUpdates()]);
    return { available: true, stats, updates };
  } catch (error) {
    if (!hasErrorCode(error, "ECONNREFUSED")) throw error;
    return { available: false, stats: null, updates: null };
  }
}
