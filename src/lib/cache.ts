/**
 * In-memory TTL cache for high-latency remote database queries (Neon AWS us-east-2).
 * Prevents concurrent connection pool starvation while strictly ensuring
 * all data originates from and persists to PostgreSQL.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const globalForCache = globalThis as unknown as {
  continuityMemoryCache?: Map<string, CacheEntry<unknown>>;
};

const memoryCache =
  globalForCache.continuityMemoryCache ?? new Map<string, CacheEntry<unknown>>();
globalForCache.continuityMemoryCache = memoryCache;

export function getCached<T>(key: string): T | undefined {
  if (process.env.NODE_ENV === "test") return undefined;
  const entry = memoryCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, ttlSeconds: number = 30): void {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }
}
