import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUserProfile } from '@/lib/userProfileResolver';
import { applySessionCookieHeader } from '@/lib/sessionUser';

export const dynamic = 'force-dynamic';

type CompletionByTrack = Record<string, string[]>;

function parseTrackId(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
}

function normalizeCourseId(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
}

function normalizeCompletedCourseIds(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    const normalized = values
        .map((value) => normalizeCourseId(value))
        .filter((value): value is string => Boolean(value));
    return Array.from(new Set(normalized));
}

function normalizeCompletionByTrack(value: unknown): CompletionByTrack {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    const entries = Object.entries(value);
    const result: CompletionByTrack = {};

    for (const [trackKey, courseIds] of entries) {
        const normalized = normalizeCompletedCourseIds(courseIds);
        if (normalized.length > 0) {
            result[trackKey] = normalized;
        } else {
            result[trackKey] = [];
        }
    }

    return result;
}

async function loadCompletion(userId: number): Promise<CompletionByTrack> {
    const rows = await prisma.plannerProgress.findMany({
        where: { userId },
        select: {
            trackId: true,
            courseId: true,
        },
        orderBy: [
            { trackId: 'asc' },
            { id: 'asc' },
        ],
    });

    return rows.reduce<CompletionByTrack>((acc, row) => {
        const key = String(row.trackId);
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(row.courseId);
        return acc;
    }, {});
}

export async function GET(request: Request) {
    try {
        const session = await resolveUserProfile(request);
        const completionByTrack = await loadCompletion(session.userId);

        const response = NextResponse.json({
            success: true,
            completionByTrack,
        });
        applySessionCookieHeader(response, session.setCookie);
        return response;
    } catch (e) {
        console.error('API GET /api/planning/progress - Error:', e);
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await resolveUserProfile(request);
        const body = await request.json();

        const trackId = parseTrackId(body?.trackId);
        if (!trackId) {
            return NextResponse.json({ success: false, error: 'trackId is required.' }, { status: 400 });
        }

        const completedCourseIds = normalizeCompletedCourseIds(body?.completedCourseIds);

        await prisma.$transaction(async (tx) => {
            await tx.plannerProgress.deleteMany({
                where: {
                    userId: session.userId,
                    trackId,
                },
            });

            if (completedCourseIds.length > 0) {
                await tx.plannerProgress.createMany({
                    data: completedCourseIds.map((courseId) => ({
                        userId: session.userId,
                        trackId,
                        courseId,
                    })),
                });
            }
        });

        const completionByTrack = await loadCompletion(session.userId);
        const responsePayload = {
            success: true,
            completionByTrack: normalizeCompletionByTrack(completionByTrack),
        };

        const response = NextResponse.json(responsePayload);
        applySessionCookieHeader(response, session.setCookie);
        return response;
    } catch (e) {
        console.error('API POST /api/planning/progress - Error:', e);
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
