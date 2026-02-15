import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUserProfile } from '@/lib/userProfileResolver';
import { applySessionCookieHeader } from '@/lib/sessionUser';
import { buildPlanForTrack, getCurriculumCatalogSnapshotWithDbFallback, resolveCurriculumYearRange } from '@/lib/planningRequirements';
import { ensurePlanningCatalogSeeded } from '@/lib/planningCatalogSeed';

async function loadCompletionByTrack(userId: number, trackId: number): Promise<string[]> {
    const rows = await prisma.plannerProgress.findMany({
        where: { userId, trackId },
        orderBy: { id: 'asc' },
        select: { courseId: true },
    });

    return rows.map((row) => row.courseId);
}

function parseTrackId(value: string | null): number | null {
    if (!value) return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
}

export async function GET(request: Request) {
    try {
        const seed = await ensurePlanningCatalogSeeded();
        const catalog = await getCurriculumCatalogSnapshotWithDbFallback();
        const trackIdByKey = Object.fromEntries(seed.tracks.map((track) => [track.trackKey, track.trackId]));
        const { searchParams } = new URL(request.url);
        const session = await resolveUserProfile(request);

        const requestedTrackId = parseTrackId(searchParams.get('trackId'));
        const trackId = requestedTrackId ?? session.profile.trackId;

        if (!trackId) {
            return NextResponse.json({ success: false, error: 'Track is required. Please set a track in settings.' }, { status: 400 });
        }

        const requestedYear = Number(searchParams.get('academicYear'));
        const normalizedYear = Number.isFinite(requestedYear) ? Math.trunc(requestedYear) : null;

        const completed = await loadCompletionByTrack(session.userId, trackId);
        const payload = buildPlanForTrack(trackId, {
            requestedYear: normalizedYear,
            completedCourseIds: completed,
            profileCohortYear: session.profile.cohortYear ?? null,
            profileGrade: session.profile.grade,
            trackIdByKey,
            catalog,
        });
        const completionByTrack = { [String(trackId)]: payload.track.completionByCourseIds };

        const response = NextResponse.json({
            success: true,
            ...payload,
            completionByTrack,
            track: payload.track,
            profile: {
                grade: session.profile.grade,
                cohortYear: session.profile.cohortYear,
                trackId,
            },
            availableYears: resolveCurriculumYearRange(catalog).years,
        });

        applySessionCookieHeader(response, session.setCookie);
        return response;
    } catch (error) {
        console.error('GET /api/planning/requirements - Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
