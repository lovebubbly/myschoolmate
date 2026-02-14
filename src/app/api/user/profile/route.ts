
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
    applySessionCookieHeader,
} from '@/lib/sessionUser';
import { resolveUserProfile } from '@/lib/userProfileResolver';

export const dynamic = 'force-dynamic';

function parseOptionalInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.trunc(parsed);
}

function parseOptionalFloat(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
}

function parseOptionalEmail(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    // Keep email validation intentionally lightweight for UX.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
    return normalized;
}

function parseOptionalBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    return null;
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
        const body = await req.json();
        const { grade, income, gpa, trackId, notificationEmail, emailAlertsEnabled } = body;

        const parsedGrade = parseOptionalInt(grade);
        const parsedIncome = parseOptionalInt(income);
        const parsedGpa = parseOptionalFloat(gpa);
        const parsedTrackId = parseOptionalInt(trackId);
        const parsedNotificationEmail = parseOptionalEmail(notificationEmail);
        const parsedEmailAlertsEnabled = parseOptionalBoolean(emailAlertsEnabled);
        const hasNotificationEmail = Object.prototype.hasOwnProperty.call(body, 'notificationEmail');
        const nextNotificationEmail = hasNotificationEmail
            ? parsedNotificationEmail
            : session.profile.notificationEmail;

        const profile = await prisma.userProfile.upsert({
            where: { id: session.userId },
            update: {
                grade: parsedGrade ?? session.profile.grade,
                income: parsedIncome ?? session.profile.income,
                gpa: parsedGpa ?? session.profile.gpa,
                trackId: parsedTrackId,
                notificationEmail: nextNotificationEmail,
                emailAlertsEnabled: parsedEmailAlertsEnabled ?? session.profile.emailAlertsEnabled,
            },
            create: {
                id: session.userId,
                grade: parsedGrade ?? session.profile.grade,
                income: parsedIncome ?? session.profile.income,
                gpa: parsedGpa ?? session.profile.gpa,
                trackId: parsedTrackId,
                notificationEmail: nextNotificationEmail,
                emailAlertsEnabled: parsedEmailAlertsEnabled ?? false,
            }
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
