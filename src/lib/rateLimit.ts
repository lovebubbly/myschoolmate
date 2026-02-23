type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitStore = Map<string, RateLimitEntry>;

type GlobalRateLimitState = typeof globalThis & {
  __myschoolmateRateLimitStore?: RateLimitStore;
  __myschoolmateRateLimitGcCounter?: number;
};

const globalRateLimitState = globalThis as GlobalRateLimitState;
const GC_INTERVAL = 200;
const GC_STALE_GRACE_MS = 60_000;

const IP_HEADER_CANDIDATES = [
  'x-forwarded-for',
  'x-vercel-forwarded-for',
  'x-real-ip',
  'x-client-ip',
  'cf-connecting-ip',
  'true-client-ip',
  'fly-client-ip',
] as const;

function toPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.trunc(value);
  return rounded > 0 ? rounded : fallback;
}

function getRateLimitStore(): RateLimitStore {
  if (!globalRateLimitState.__myschoolmateRateLimitStore) {
    globalRateLimitState.__myschoolmateRateLimitStore = new Map<string, RateLimitEntry>();
  }
  return globalRateLimitState.__myschoolmateRateLimitStore;
}

function maybeCompactStore(store: RateLimitStore, now: number) {
  const nextCounter = (globalRateLimitState.__myschoolmateRateLimitGcCounter || 0) + 1;
  globalRateLimitState.__myschoolmateRateLimitGcCounter = nextCounter;
  if (nextCounter % GC_INTERVAL !== 0) return;

  for (const [key, entry] of store.entries()) {
    if (entry.resetAt + GC_STALE_GRACE_MS < now) {
      store.delete(key);
    }
  }
}

function parseForwardedIp(value: string): string {
  const first = value.split(',')[0]?.trim();
  return first || '';
}

export function extractClientIp(request: Request): string {
  const headers = request.headers;

  for (const header of IP_HEADER_CANDIDATES) {
    const raw = headers.get(header)?.trim();
    if (!raw) continue;
    if (header === 'x-forwarded-for' || header === 'x-vercel-forwarded-for') {
      const parsed = parseForwardedIp(raw);
      if (parsed) return parsed;
      continue;
    }
    return raw;
  }

  return 'unknown';
}

export function buildRateLimitKeyFromRequest(request: Request): string {
  const ip = extractClientIp(request);
  if (ip !== 'unknown') return ip;

  const ua = request.headers.get('user-agent')?.trim() || 'unknown';
  return `unknown:${ua.slice(0, 160)}`;
}

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

type CheckRateLimitOptions = {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

export function checkRateLimit(options: CheckRateLimitOptions): RateLimitDecision {
  const limit = toPositiveInt(options.limit, 1);
  const windowMs = toPositiveInt(options.windowMs, 60_000);
  const now = options.now ?? Date.now();
  const store = getRateLimitStore();
  const storeKey = `${options.namespace}:${options.key}`;

  maybeCompactStore(store, now);

  const existing = store.get(storeKey);
  if (!existing || now >= existing.resetAt) {
    const nextEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(storeKey, nextEntry);
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt: nextEntry.resetAt,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  store.set(storeKey, existing);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}

export function applyRateLimitHeaders(response: Response, decision: RateLimitDecision) {
  response.headers.set('X-RateLimit-Limit', String(decision.limit));
  response.headers.set('X-RateLimit-Remaining', String(decision.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.ceil(decision.resetAt / 1000)));

  if (!decision.allowed) {
    response.headers.set('Retry-After', String(decision.retryAfterSeconds));
  }
}
