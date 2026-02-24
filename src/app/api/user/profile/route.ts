import { NextResponse } from 'next/server';
import type { UserProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
    applySessionCookieHeader,
} from '@/lib/sessionUser';
import { resolveUserProfile } from '@/lib/userProfileResolver';
import { ensurePlanningCatalogSeeded } from '@/lib/planningCatalogSeed';

export const dynamic = 'force-dynamic';

const VALID_WIDGET_IDS = ['inbox', 'cafeteria', 'notices'] as const;
const VALID_BRIEFING_TONES = ['friendly', 'concise', 'formal', 'motivational'] as const;
const VALID_BRIEFING_LENGTHS = ['short', 'medium', 'long'] as const;
const VALID_BRIEFING_FOCUS_CATEGORIES = ['Academic', 'Scholarship', 'Employment', 'General', 'News'] as const;
const WATCHLIST_MAX_ITEMS = 30;
const WATCHLIST_MAX_LENGTH = 40;

type BriefingTone = (typeof VALID_BRIEFING_TONES)[number];
type BriefingLength = (typeof VALID_BRIEFING_LENGTHS)[number];
type BriefingCategory = (typeof VALID_BRIEFING_FOCUS_CATEGORIES)[number];

type DashboardState = {
    readNoticeIds?: number[];
    widgetOrder?: string[];
    enabledWidgets?: {
        inbox?: boolean;
        cafeteria?: boolean;
        notices?: boolean;
    };
    watchlist?: {
        keywords?: string[];
        tags?: string[];
    };
    briefing?: {
        tone?: BriefingTone;
        length?: BriefingLength;
        focusCategories?: BriefingCategory[];
    };
};

function parseOptionalInt(value: unknown, options: { min?: number; max?: number; nullable?: boolean } = {}) {
    if (value === undefined || value === '') {
        return { provided: false, value: null as number | null };
    }

    if (value === null) {
        return options.nullable
            ? { provided: true, value: null as number | null }
            : { provided: true, value: null as number | null, invalid: true };
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return { provided: true, value: null as number | null, invalid: true };

    if (options.min !== undefined && parsed < options.min) {
        return { provided: true, value: null as number | null, invalid: true };
    }

    if (options.max !== undefined && parsed > options.max) {
        return { provided: true, value: null as number | null, invalid: true };
    }

    return { provided: true, value: Math.trunc(parsed) };
}

function parseOptionalFloat(value: unknown, options: { min?: number; max?: number } = {}) {
    if (value === null || value === undefined || value === '') {
        return { provided: false, value: null as number | null };
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return { provided: true, value: null as number | null, invalid: true };

    if (options.min !== undefined && parsed < options.min) {
        return { provided: true, value: null as number | null, invalid: true };
    }

    if (options.max !== undefined && parsed > options.max) {
        return { provided: true, value: null as number | null, invalid: true };
    }

    return { provided: true, value: parsed };
}

function parseOptionalEmail(value: unknown) {
    if (value === undefined) return { provided: false, value: null as string | null };
    if (value === null) {
        return { provided: true, value: null as string | null };
    }

    if (typeof value !== 'string') {
        return { provided: true, value: null as string | null, invalid: true };
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        return { provided: true, value: null as string | null };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return { provided: true, value: null as string | null, invalid: true };
    }

    return { provided: true, value: normalized };
}

function parseOptionalBoolean(value: unknown) {
    if (value === undefined) return { provided: false, value: null as boolean | null };
    if (typeof value !== 'boolean') return { provided: true, value: null as boolean | null, invalid: true };
    return { provided: true, value };
}

function normalizeWatchlistItems(raw: unknown) {
    if (raw === undefined) return { provided: false, value: [] as string[] };
    if (!Array.isArray(raw)) return { provided: true, value: [] as string[], invalid: true };

    const cleaned = raw
        .map((item) => String(item ?? '').trim())
        .filter((item) => item.length > 0 && item.length <= WATCHLIST_MAX_LENGTH);
    const deduped = Array.from(new Set(cleaned)).slice(0, WATCHLIST_MAX_ITEMS);

    return { provided: true, value: deduped };
}

function parseDashboardState(value: unknown) {
    if (value === undefined) {
        return { provided: false, value: null as DashboardState | null };
    }

    if (value === null) {
        return { provided: true, value: null as DashboardState | null };
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
        return { provided: true, value: null as DashboardState | null, invalid: true };
    }

    const raw = value as Record<string, unknown>;
    const next: DashboardState = {};

    if ('readNoticeIds' in raw) {
        if (!Array.isArray(raw.readNoticeIds)) {
            return { provided: true, value: null as DashboardState | null, invalid: true };
        }

        const parsedIds = raw.readNoticeIds
            .map((item) => {
                const num = Number(item);
                return Number.isInteger(num) && num > 0 ? num : null;
            })
            .filter((item): item is number => item !== null);

        next.readNoticeIds = Array.from(new Set(parsedIds));
    }

    if ('widgetOrder' in raw) {
        if (!Array.isArray(raw.widgetOrder)) {
            return { provided: true, value: null as DashboardState | null, invalid: true };
        }

        const order = raw.widgetOrder
            .map((item) => String(item))
            .map((item) => item.trim())
            .filter(Boolean)
            .filter((item): item is (typeof VALID_WIDGET_IDS)[number] => (VALID_WIDGET_IDS as readonly string[]).includes(item));

        next.widgetOrder = Array.from(new Set(order));
    }

    if ('enabledWidgets' in raw) {
        if (raw.enabledWidgets === null || typeof raw.enabledWidgets !== 'object' || Array.isArray(raw.enabledWidgets)) {
            return { provided: true, value: null as DashboardState | null, invalid: true };
        }

        const enabledRaw = raw.enabledWidgets as Record<string, unknown>;
        type EnabledWidgets = NonNullable<DashboardState['enabledWidgets']>;
        const enabled: Partial<EnabledWidgets> = {};
        let enabledInvalid = false;

        for (const key of VALID_WIDGET_IDS as unknown as Array<keyof EnabledWidgets>) {
            const boolValue = enabledRaw[key as string];
            if (typeof boolValue === 'boolean') {
                enabled[key] = boolValue;
            } else if (boolValue === undefined) {
                // no-op
            } else {
                enabledInvalid = true;
            }
        }

        if (enabledInvalid) {
            return { provided: true, value: null as DashboardState | null, invalid: true };
        }

        next.enabledWidgets = enabled;
    }

    if ('watchlist' in raw) {
        const rawWatchlist = raw.watchlist;
        if (rawWatchlist === null) {
            next.watchlist = {};
        } else if (typeof rawWatchlist !== 'object' || Array.isArray(rawWatchlist)) {
            return { provided: true, value: null as DashboardState | null, invalid: true };
        } else {
            const watchlistRaw = rawWatchlist as Record<string, unknown>;
            const parsedWatchlist: NonNullable<DashboardState['watchlist']> = {};

            if ('keywords' in watchlistRaw) {
                const parsedKeywords = normalizeWatchlistItems(watchlistRaw.keywords);
                if (parsedKeywords.invalid) {
                    return { provided: true, value: null as DashboardState | null, invalid: true };
                }
                if (parsedKeywords.provided) parsedWatchlist.keywords = parsedKeywords.value;
            }

            if ('tags' in watchlistRaw) {
                const parsedTags = normalizeWatchlistItems(watchlistRaw.tags);
                if (parsedTags.invalid) {
                    return { provided: true, value: null as DashboardState | null, invalid: true };
                }
                if (parsedTags.provided) parsedWatchlist.tags = parsedTags.value;
            }

            next.watchlist = parsedWatchlist;
        }
    }

    const rawBriefing = raw.briefing ?? raw.briefingOptions ?? raw.briefingSettings;
    if (rawBriefing !== undefined) {
        if (rawBriefing === null) {
            next.briefing = {};
        } else if (typeof rawBriefing !== 'object' || Array.isArray(rawBriefing)) {
            return { provided: true, value: null as DashboardState | null, invalid: true };
        } else {
            const briefingRaw = rawBriefing as Record<string, unknown>;
            const parsedBriefing: NonNullable<DashboardState['briefing']> = {};

            if ('tone' in briefingRaw) {
                const tone = String(briefingRaw.tone ?? '').trim();
                if ((VALID_BRIEFING_TONES as readonly string[]).includes(tone)) {
                    parsedBriefing.tone = tone as BriefingTone;
                } else if (tone) {
                    return { provided: true, value: null as DashboardState | null, invalid: true };
                }
            }

            if ('length' in briefingRaw) {
                const length = String(briefingRaw.length ?? '').trim();
                if ((VALID_BRIEFING_LENGTHS as readonly string[]).includes(length)) {
                    parsedBriefing.length = length as BriefingLength;
                } else if (length) {
                    return { provided: true, value: null as DashboardState | null, invalid: true };
                }
            }

            if ('focusCategories' in briefingRaw) {
                if (!Array.isArray(briefingRaw.focusCategories)) {
                    return { provided: true, value: null as DashboardState | null, invalid: true };
                }
                const categories = Array.from(new Set(
                    briefingRaw.focusCategories
                        .map((item) => String(item ?? '').trim())
                        .filter((item): item is BriefingCategory => (VALID_BRIEFING_FOCUS_CATEGORIES as readonly string[]).includes(item)),
                ));
                parsedBriefing.focusCategories = categories;
            }

            next.briefing = parsedBriefing;
        }
    }

    return { provided: true, value: next };
}

function decodeDashboardState(rawState: string | null | undefined): DashboardState | null {
    if (!rawState) return null;

    try {
        const parsed = JSON.parse(rawState);
        return parseDashboardState(parsed).value;
    } catch {
        return null;
    }
}

function encodeDashboardState(state: DashboardState | null | undefined): string | null {
    if (!state) return null;
    return JSON.stringify(state);
}

function mergeNestedObject<T extends Record<string, unknown> | undefined>(
    currentValue: T,
    incomingValue: T,
): T {
    if (incomingValue === undefined) return currentValue;
    if (!incomingValue || Object.keys(incomingValue).length === 0) return {} as T;
    return { ...(currentValue ?? {}), ...(incomingValue ?? {}) } as T;
}

function mergeDashboardState(current: DashboardState | null, incoming: DashboardState | null): DashboardState | null {
    // dashboardState=null is treated as an explicit clear.
    if (incoming === null) return null;
    if (!incoming) return current;

    const next: DashboardState = {
        ...(current ?? {}),
        ...incoming,
    };

    if (incoming.enabledWidgets !== undefined) {
        next.enabledWidgets = mergeNestedObject(current?.enabledWidgets, incoming.enabledWidgets);
    }

    if (incoming.watchlist !== undefined) {
        next.watchlist = mergeNestedObject(current?.watchlist, incoming.watchlist);
    }

    if (incoming.briefing !== undefined) {
        next.briefing = mergeNestedObject(current?.briefing, incoming.briefing);
    }

    return next;
}

function withParsedDashboardState(profile: UserProfile) {
    const dashboardState = decodeDashboardState(profile.dashboardState ?? undefined);
    return { ...profile, dashboardState };
}

export async function GET(request: Request) {
    try {
        await ensurePlanningCatalogSeeded();
        const session = await resolveUserProfile(request);
        const response = NextResponse.json({
            success: true,
            profile: withParsedDashboardState(session.profile),
            userId: session.userId,
            source: session.source,
        });
        applySessionCookieHeader(response, session.setCookie);
        return response;
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        await ensurePlanningCatalogSeeded();
        const session = await resolveUserProfile(req);
        const body = await req.json().catch(() => ({}));

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
        }

    const hasGrade = Object.prototype.hasOwnProperty.call(body, 'grade');
    const hasIncome = Object.prototype.hasOwnProperty.call(body, 'income');
    const hasGpa = Object.prototype.hasOwnProperty.call(body, 'gpa');
    const hasCohortYear = Object.prototype.hasOwnProperty.call(body, 'cohortYear');
    const hasTrackId = Object.prototype.hasOwnProperty.call(body, 'trackId');
    const hasNotificationEmail = Object.prototype.hasOwnProperty.call(body, 'notificationEmail');
    const hasEmailAlertsEnabled = Object.prototype.hasOwnProperty.call(body, 'emailAlertsEnabled');
    const hasDashboardState = Object.prototype.hasOwnProperty.call(body, 'dashboardState');

        const parsedGrade = parseOptionalInt(body.grade, { min: 1, max: 4 });
        const parsedIncome = parseOptionalInt(body.income, { min: 0, max: 10 });
        const parsedGpa = parseOptionalFloat(body.gpa, { min: 0, max: 4.5 });
        const parsedTrackId = parseOptionalInt(body.trackId, { min: 1, nullable: true });
        const parsedCohortYear = parseOptionalInt(body.cohortYear, { min: 2010, max: 2030, nullable: true });
        const parsedNotificationEmail = parseOptionalEmail(body.notificationEmail);
        const parsedEmailAlertsEnabled = parseOptionalBoolean(body.emailAlertsEnabled);
        const parsedDashboardState = parseDashboardState((body as { dashboardState?: unknown }).dashboardState);

        const validationErrors: string[] = [];

        if (hasGrade && parsedGrade.invalid) validationErrors.push('grade must be integer 1..4');
        if (hasIncome && parsedIncome.invalid) validationErrors.push('income must be integer 0..10');
        if (hasGpa && parsedGpa.invalid) validationErrors.push('gpa must be number 0..4.5');
        if (hasTrackId && parsedTrackId.invalid) validationErrors.push('trackId must be integer >=1 or null');
        if (hasCohortYear && parsedCohortYear.invalid) validationErrors.push('cohortYear must be integer 2010..2030');
        if (hasNotificationEmail && parsedNotificationEmail.invalid) validationErrors.push('notificationEmail format is invalid');
        if (hasEmailAlertsEnabled && parsedEmailAlertsEnabled.invalid) validationErrors.push('emailAlertsEnabled must be boolean');
        if (hasDashboardState && parsedDashboardState.invalid) validationErrors.push('dashboardState format is invalid');

        if (validationErrors.length > 0) {
            return NextResponse.json({ success: false, error: validationErrors.join(', ') }, { status: 400 });
        }

        const hasNotificationEmailValue = hasNotificationEmail
            ? parsedNotificationEmail.value
            : session.profile.notificationEmail;

        const updatePayload: Record<string, unknown> = {};
        if (hasGrade) updatePayload.grade = parsedGrade.value;
        if (hasIncome) updatePayload.income = parsedIncome.value;
        if (hasGpa) updatePayload.gpa = parsedGpa.value;
        if (hasTrackId) updatePayload.trackId = parsedTrackId.value;
        if (hasCohortYear) updatePayload.cohortYear = parsedCohortYear.value;
        if (hasNotificationEmail) updatePayload.notificationEmail = hasNotificationEmailValue;
        if (hasEmailAlertsEnabled) updatePayload.emailAlertsEnabled = parsedEmailAlertsEnabled.value;

        const encodedDashboardState = hasDashboardState
            ? encodeDashboardState(
                mergeDashboardState(
                    decodeDashboardState(session.profile.dashboardState ?? undefined),
                    parsedDashboardState.value,
                ),
            )
            : null;

        if (hasDashboardState) {
            updatePayload.dashboardState = encodedDashboardState;
        }

        const profile = await prisma.userProfile.upsert({
            where: { id: session.userId },
            update: updatePayload,
            create: {
                id: session.userId,
                grade: hasGrade ? parsedGrade.value ?? session.profile.grade : session.profile.grade,
                income: hasIncome ? parsedIncome.value ?? session.profile.income : session.profile.income,
                gpa: hasGpa ? parsedGpa.value ?? session.profile.gpa : session.profile.gpa,
                trackId: hasTrackId ? parsedTrackId.value : session.profile.trackId,
                cohortYear: hasCohortYear ? parsedCohortYear.value : session.profile.cohortYear,
                notificationEmail: hasNotificationEmail ? hasNotificationEmailValue : session.profile.notificationEmail,
                emailAlertsEnabled: hasEmailAlertsEnabled ? parsedEmailAlertsEnabled.value ?? false : false,
                dashboardState: hasDashboardState ? encodedDashboardState : session.profile.dashboardState,
            },
        });

        const response = NextResponse.json({
            success: true,
            profile: withParsedDashboardState(profile),
            userId: session.userId,
            source: session.source,
        });
        applySessionCookieHeader(response, session.setCookie);
        return response;
    } catch (e) {
        console.error('API POST /api/user/profile - Error:', e);
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
