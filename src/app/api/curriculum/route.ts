import { NextResponse } from 'next/server';
import { buildTracksForYear } from '@/lib/planningRequirements';
import { ensurePlanningCatalogSeeded } from '@/lib/planningCatalogSeed';

export async function GET(request: Request) {
    try {
        const seed = await ensurePlanningCatalogSeeded();
        const trackIdByKey = Object.fromEntries(seed.tracks.map((track) => [track.trackKey, track.trackId]));
        const { searchParams } = new URL(request.url);
        const requestedYear = (() => {
            const raw = searchParams.get('academicYear');
            if (!raw) return null;
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
        })();

        const payload = buildTracksForYear(requestedYear, { trackIdByKey });

        return NextResponse.json({
            success: true,
            tracks: payload.tracks,
            academicYear: payload.academicYear,
            sourceYear: payload.sourceYear,
            availableYears: payload.availableYears,
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
