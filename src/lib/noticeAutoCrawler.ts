import { crawlNotices } from '@/lib/crawler';
import { prisma } from '@/lib/prisma';
import { broadcastNewNoticePush } from '@/lib/pushAlerts';
import { getSystemMeta, setSystemMeta } from '@/lib/systemMeta';
import { getSystemLock, releaseSystemLock, tryAcquireSystemLock } from '@/lib/systemLock';

type EnsureFreshResult = {
    triggered: boolean;
    reason: 'fresh' | 'stale' | 'no-data' | 'cooldown' | 'already-running';
    latestNoticeAt: string | null;
};

type TriggerResult = {
    triggered: boolean;
    reason: 'started' | 'already-running';
    count: number;
};

type TriggerOptions = {
    refreshExisting?: boolean;
};

type NoticeAutoCrawlerState = {
    started: boolean;
    running: boolean;
    timer: ReturnType<typeof setInterval> | null;
    intervalMs: number;
    maxAgeMs: number;
    minRetryGapMs: number;

    // These are mirrored from persisted meta (best-effort).
    lastAttemptAt: number;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    lastFailureReason: string | null;
    retryCount: number;
    lastTrigger: string | null;
    lastProcessedCount: number;
};

type NoticeAutoCrawlerMeta = {
    lastAttemptAt: number;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    lastFailureReason: string | null;
    retryCount: number;
    lastTrigger: string | null;
    lastProcessedCount: number;
};

const META_KEY = 'noticeAutoCrawler';
const LOCK_NAME = 'noticeAutoCrawler:crawl';

const defaultMeta: NoticeAutoCrawlerMeta = {
    lastAttemptAt: 0,
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
    lastFailureReason: null,
    retryCount: 0,
    lastTrigger: null,
    lastProcessedCount: 0,
};

const globalForNoticeAutoCrawler = globalThis as typeof globalThis & {
    __noticeAutoCrawler?: NoticeAutoCrawlerState;
};

function envMinutes(name: string, fallbackMinutes: number) {
    const raw = process.env[name];
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMinutes;
}

function getState(): NoticeAutoCrawlerState {
    if (!globalForNoticeAutoCrawler.__noticeAutoCrawler) {
        globalForNoticeAutoCrawler.__noticeAutoCrawler = {
            started: false,
            running: false,
            timer: null,
            intervalMs: envMinutes('NOTICE_AUTO_CRAWL_INTERVAL_MINUTES', 120) * 60 * 1000,
            maxAgeMs: envMinutes('NOTICE_AUTO_CRAWL_MAX_AGE_MINUTES', 180) * 60 * 1000,
            minRetryGapMs: envMinutes('NOTICE_AUTO_CRAWL_RETRY_GAP_MINUTES', 5) * 60 * 1000,
            ...defaultMeta,
        };
    }
    return globalForNoticeAutoCrawler.__noticeAutoCrawler;
}

function syncStateFromMeta(state: NoticeAutoCrawlerState, meta: NoticeAutoCrawlerMeta) {
    state.lastAttemptAt = meta.lastAttemptAt;
    state.lastRunAt = meta.lastRunAt;
    state.lastSuccessAt = meta.lastSuccessAt;
    state.lastError = meta.lastError;
    state.lastFailureReason = meta.lastFailureReason;
    state.retryCount = meta.retryCount;
    state.lastTrigger = meta.lastTrigger;
    state.lastProcessedCount = meta.lastProcessedCount;
}

async function getLatestNoticeUpdatedAt() {
    const latestNotice = await prisma.notice.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
    });
    return latestNotice?.updatedAt ?? null;
}

async function loadMetaAndSync(): Promise<NoticeAutoCrawlerMeta> {
    const state = getState();
    const meta = await getSystemMeta<NoticeAutoCrawlerMeta>(META_KEY, defaultMeta);
    syncStateFromMeta(state, meta);
    return meta;
}

async function persistMeta(next: NoticeAutoCrawlerMeta): Promise<void> {
    await setSystemMeta(META_KEY, next);
    syncStateFromMeta(getState(), next);
}

async function runCrawl(trigger: string, options?: TriggerOptions): Promise<TriggerResult> {
    const state = getState();

    // Fast in-process guard.
    if (state.running) {
        return { triggered: false, reason: 'already-running', count: 0 };
    }

    // Cross-process best-effort lock.
    const acquired = await tryAcquireSystemLock(LOCK_NAME);
    if (!acquired) {
        return { triggered: false, reason: 'already-running', count: 0 };
    }

    state.running = true;

    const prev = await loadMetaAndSync();
    const attemptMeta: NoticeAutoCrawlerMeta = {
        ...prev,
        lastAttemptAt: Date.now(),
        lastTrigger: trigger,
    };
    await persistMeta(attemptMeta);

    try {
        const crawled = await crawlNotices({
            refreshExisting: options?.refreshExisting === true,
        });

        if (crawled.length > 0) {
            void broadcastNewNoticePush(
                crawled.map((notice) => ({
                    title: notice.title,
                    url: notice.url,
                })),
            ).catch((error) => {
                console.error('[noticeAutoCrawler] push broadcast failed:', error);
            });
        }

        const nowIso = new Date().toISOString();
        await persistMeta({
            ...attemptMeta,
            lastRunAt: nowIso,
            lastSuccessAt: nowIso,
            lastError: null,
            lastFailureReason: null,
            retryCount: 0,
            lastProcessedCount: crawled.length,
        });

        return { triggered: true, reason: 'started', count: crawled.length };
    } catch (error) {
        const nowIso = new Date().toISOString();
        const reason = String(error);
        await persistMeta({
            ...attemptMeta,
            lastRunAt: nowIso,
            lastError: reason,
            lastFailureReason: reason,
            retryCount: (attemptMeta.retryCount || 0) + 1,
        });
        throw error;
    } finally {
        state.running = false;
        await releaseSystemLock(LOCK_NAME);
    }
}

export async function ensureFreshNotices(trigger = 'stale-check'): Promise<EnsureFreshResult> {
    const state = getState();
    const now = Date.now();

    const [latestNoticeAt, meta, lock] = await Promise.all([
        getLatestNoticeUpdatedAt(),
        loadMetaAndSync(),
        getSystemLock(LOCK_NAME),
    ]);

    if (state.running) {
        return {
            triggered: false,
            reason: 'already-running',
            latestNoticeAt: latestNoticeAt ? latestNoticeAt.toISOString() : null,
        };
    }

    if (lock?.lockedUntil && lock.lockedUntil.getTime() > now) {
        return {
            triggered: false,
            reason: 'already-running',
            latestNoticeAt: latestNoticeAt ? latestNoticeAt.toISOString() : null,
        };
    }

    if (now - meta.lastAttemptAt < state.minRetryGapMs) {
        return {
            triggered: false,
            reason: 'cooldown',
            latestNoticeAt: latestNoticeAt ? latestNoticeAt.toISOString() : null,
        };
    }

    if (!latestNoticeAt) {
        await runCrawl(`${trigger}:no-data`);
        const nextLatest = await getLatestNoticeUpdatedAt();
        return {
            triggered: true,
            reason: 'no-data',
            latestNoticeAt: nextLatest ? nextLatest.toISOString() : null,
        };
    }

    const ageMs = now - latestNoticeAt.getTime();
    if (ageMs <= state.maxAgeMs) {
        return {
            triggered: false,
            reason: 'fresh',
            latestNoticeAt: latestNoticeAt.toISOString(),
        };
    }

    await runCrawl(`${trigger}:stale`);
    const nextLatest = await getLatestNoticeUpdatedAt();
    return {
        triggered: true,
        reason: 'stale',
        latestNoticeAt: nextLatest ? nextLatest.toISOString() : null,
    };
}

export function startNoticeAutoCrawler() {
    const state = getState();
    if (state.started) return;

    state.started = true;
    state.timer = setInterval(() => {
        void ensureFreshNotices('interval').catch((error) => {
            const reason = String(error);
            console.error('[noticeAutoCrawler] interval failed:', reason);
        });
    }, state.intervalMs);

    if (typeof state.timer === 'object' && typeof state.timer.unref === 'function') {
        state.timer.unref();
    }

    void ensureFreshNotices('startup').catch((error) => {
        const reason = String(error);
        console.error('[noticeAutoCrawler] startup failed:', reason);
    });
}

export async function triggerNoticeCrawl(trigger = 'manual', options?: TriggerOptions): Promise<TriggerResult> {
    return runCrawl(trigger, options);
}

export async function getNoticeAutoCrawlerStatus() {
    const state = getState();
    const [meta, lock] = await Promise.all([
        loadMetaAndSync(),
        getSystemLock(LOCK_NAME),
    ]);

    const now = Date.now();
    const locked = Boolean(lock?.lockedUntil && lock.lockedUntil.getTime() > now);

    return {
        started: state.started,
        running: state.running || locked,
        intervalMinutes: Math.round(state.intervalMs / 60000),
        maxAgeMinutes: Math.round(state.maxAgeMs / 60000),
        minRetryGapMinutes: Math.round(state.minRetryGapMs / 60000),
        lastAttemptAt: meta.lastAttemptAt ? new Date(meta.lastAttemptAt).toISOString() : null,
        lastRunAt: meta.lastRunAt,
        lastSuccessAt: meta.lastSuccessAt,
        lastError: meta.lastError,
        lastFailureReason: meta.lastFailureReason,
        retryCount: meta.retryCount,
        lastTrigger: meta.lastTrigger,
        lastProcessedCount: meta.lastProcessedCount,
        lock: lock
            ? {
                lockedUntil: lock.lockedUntil ? lock.lockedUntil.toISOString() : null,
                lockedBy: lock.lockedBy,
              }
            : null,
    };
}
