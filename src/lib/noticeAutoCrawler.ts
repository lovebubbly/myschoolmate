import { crawlNotices } from '@/lib/crawler';
import { prisma } from '@/lib/prisma';

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
    lastAttemptAt: number;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    lastFailureReason: string | null;
    retryCount: number;
    lastTrigger: string | null;
    lastProcessedCount: number;
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
            lastAttemptAt: 0,
            lastRunAt: null,
            lastSuccessAt: null,
            lastError: null,
            lastFailureReason: null,
            retryCount: 0,
            lastTrigger: null,
            lastProcessedCount: 0,
        };
    }
    return globalForNoticeAutoCrawler.__noticeAutoCrawler;
}

async function getLatestNoticeUpdatedAt() {
    const latestNotice = await prisma.notice.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
    });
    return latestNotice?.updatedAt ?? null;
}

async function runCrawl(trigger: string, options?: TriggerOptions): Promise<TriggerResult> {
    const state = getState();

    if (state.running) {
        return { triggered: false, reason: 'already-running', count: 0 };
    }

    state.running = true;
    state.lastAttemptAt = Date.now();
    state.lastTrigger = trigger;

    try {
        const crawled = await crawlNotices({
            refreshExisting: options?.refreshExisting === true,
        });
        const nowIso = new Date().toISOString();
        state.lastRunAt = nowIso;
        state.lastSuccessAt = nowIso;
        state.lastError = null;
        state.lastFailureReason = null;
        state.retryCount = 0;
        state.lastProcessedCount = crawled.length;
        return { triggered: true, reason: 'started', count: crawled.length };
    } catch (error) {
        state.lastRunAt = new Date().toISOString();
        const reason = String(error);
        state.lastError = reason;
        state.lastFailureReason = reason;
        state.retryCount += 1;
        throw error;
    } finally {
        state.running = false;
    }
}

export async function ensureFreshNotices(trigger = 'stale-check'): Promise<EnsureFreshResult> {
    const state = getState();
    const latestNoticeAt = await getLatestNoticeUpdatedAt();

    if (state.running) {
        return {
            triggered: false,
            reason: 'already-running',
            latestNoticeAt: latestNoticeAt ? latestNoticeAt.toISOString() : null,
        };
    }

    if (Date.now() - state.lastAttemptAt < state.minRetryGapMs) {
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

    const ageMs = Date.now() - latestNoticeAt.getTime();
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
            const current = getState();
            const reason = String(error);
            current.lastError = reason;
            current.lastFailureReason = reason;
            current.retryCount += 1;
        });
    }, state.intervalMs);

    if (typeof state.timer === 'object' && typeof state.timer.unref === 'function') {
        state.timer.unref();
    }

    void ensureFreshNotices('startup').catch((error) => {
        const current = getState();
        const reason = String(error);
        current.lastError = reason;
        current.lastFailureReason = reason;
        current.retryCount += 1;
    });
}

export async function triggerNoticeCrawl(trigger = 'manual', options?: TriggerOptions): Promise<TriggerResult> {
    return runCrawl(trigger, options);
}

export function getNoticeAutoCrawlerStatus() {
    const state = getState();
    return {
        started: state.started,
        running: state.running,
        intervalMinutes: Math.round(state.intervalMs / 60000),
        maxAgeMinutes: Math.round(state.maxAgeMs / 60000),
        lastRunAt: state.lastRunAt,
        lastSuccessAt: state.lastSuccessAt,
        lastError: state.lastError,
        lastFailureReason: state.lastFailureReason,
        retryCount: state.retryCount,
        lastTrigger: state.lastTrigger,
        lastProcessedCount: state.lastProcessedCount,
    };
}
