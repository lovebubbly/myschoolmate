import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    applySessionCookieHeader,
} from '@/lib/sessionUser';
import { resolveUserProfile } from '@/lib/userProfileResolver';

export const dynamic = 'force-dynamic';

const VALID_WIDGET_IDS = ['inbox', 'cafeteria', 'notices'] as const;

type DashboardState = {
    readNoticeIds?: number[];
    widgetOrder?: string[];
    enabledWidgets?: {
        inbox?: boolean;
        cafeteria?: boolean;
        notices?: boolean;
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
            .filter((item) => VALID_WIDGET_IDS.includes(item as any));

        next.widgetOrder = Array.from(new Set(order));
    }

    if ('enabledWidgets' in raw) {
        if (raw.enabledWidgets === null || typeof raw.enabledWidgets !== 'object' || Array.isArray(raw.enabledWidgets)) {
            return { provided: true, value: null as DashboardState | null, invalid: true };
        }

        const enabledRaw = raw.enabledWidgets as Record<string, unknown>;
        const enabled: DashboardState['enabledWidgets'] = {};
        let enabledInvalid = false;

        (Object.keys(enabledRaw) as Array<keyof DashboardState['enabledWidgets']>).forEach((key) => {
            if (!VALID_WIDGET_IDS.includes(key as string)) return;
            const boolValue = enabledRaw[key];
            if (typeof boolValue === 'boolean') {
                enabled[key] = boolValue;
            } else if (boolValue === undefined) {
                // no-op
            } else {
                enabledInvalid = true;
            }
        });

        if (enabledInvalid) {
            return { provided: true, value: null as DashboardState | null, invalid: true };
        }

        next.enabledWidgets = enabled;
    }

    return { provided: true, value: next };
}

export async function GET(request: Request) {
    try {
        const session = await resolveUserProfile(request);
        const response = NextResponse.json({
            success: true,
            profile: session.profile,
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

        if (hasDashboardState) {
            updatePayload.dashboardState = parsedDashboardState.value;
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
                dashboardState: hasDashboardState ? parsedDashboardState.value : session.profile.dashboardState,
            },
        });

        const response = NextResponse.json({
            success: true,
            profile,
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
