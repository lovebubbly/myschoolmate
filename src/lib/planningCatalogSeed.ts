import { prisma } from '@/lib/prisma';
import { GradeCategory, getCurriculumCatalogSnapshot } from '@/lib/planningRequirements';

type TrackSeed = { trackKey: string; trackId: number };
type SeedRunState = {
    loaded: boolean;
    inFlight: Promise<{
        tracks: TrackSeed[];
    }> | null;
    tracksSeed: TrackSeed[] | null;
    versionsCount: number;
};

const seedState: SeedRunState = {
    loaded: false,
    inFlight: null,
    tracksSeed: null,
    versionsCount: 0,
};

function normalizeCategoryRequirements(categoryRequirements: Partial<Record<GradeCategory, number>>): string | null {
    if (!Object.keys(categoryRequirements || {}).length) return null;
    return JSON.stringify(categoryRequirements);
}

function serializeRequiredCourses(requiredCourses: string[]): string {
    return JSON.stringify(requiredCourses);
}

async function loadSeedTrackMap(snapshot: ReturnType<typeof getCurriculumCatalogSnapshot>): Promise<Record<string, number>> {
    const tracks = Object.entries(snapshot.tracks);
    if (tracks.length === 0) return {};

    const existingTracks = await prisma.track.findMany({ select: { id: true, name: true } });
    const byName = new Map(existingTracks.map((track) => [track.name, track]));

    const trackIds: Record<string, number> = {};

    await prisma.$transaction(async (tx) => {
        for (let index = 0; index < tracks.length; index += 1) {
            const [trackKey, trackValue] = tracks[index];
            const byNameMatch = byName.get(trackValue.name);
            const track = byNameMatch
                ? byNameMatch
                : await tx.track.create({
                    data: { name: trackValue.name },
                });
            byName.set(track.name, track);
            trackIds[trackKey] = track.id;
        }
    });

    return trackIds;
}

export async function ensurePlanningCatalogSeeded(): Promise<{
    tracks: TrackSeed[];
    versionsCount: number;
}> {
    if (seedState.loaded) {
        return {
            tracks: seedState.tracksSeed ?? [],
            versionsCount: seedState.versionsCount,
        };
    }

    if (!seedState.inFlight) {
        seedState.inFlight = (async () => {
            const snapshot = getCurriculumCatalogSnapshot();
            const trackIdsByKey = await loadSeedTrackMap(snapshot);
            const tracksSeed = Object.entries(trackIdsByKey).map(([trackKey, trackId]) => ({ trackKey, trackId }));
            const versionsCount = snapshot.versions.length;

            await prisma.$transaction(async (tx) => {
                const versions = snapshot.versions;
                for (const version of versions) {
                    const dbVersion = await tx.curriculumVersion.upsert({
                        where: { academicYear: version.academicYear },
                        create: {
                            academicYear: version.academicYear,
                            label: version.label,
                            source: version.source,
                            isActive: version.isActive,
                        },
                        update: {
                            label: version.label,
                            source: version.source,
                            isActive: version.isActive,
                        },
                    });

                    for (const [trackKey, requirement] of Object.entries(version.trackRequirements)) {
                        const trackId = trackIdsByKey[trackKey];
                        if (!trackId) continue;

                        await tx.trackCurriculumRequirement.upsert({
                            where: {
                                curriculumVersionId_trackId: {
                                    curriculumVersionId: dbVersion.id,
                                    trackId,
                                },
                            },
                            create: {
                                curriculumVersionId: dbVersion.id,
                                trackId,
                                requiredCourses: serializeRequiredCourses(requirement.requiredCourses),
                                categoryRequirements: normalizeCategoryRequirements(requirement.categoryRequirements),
                            },
                            update: {
                                requiredCourses: serializeRequiredCourses(requirement.requiredCourses),
                                categoryRequirements: normalizeCategoryRequirements(requirement.categoryRequirements),
                            },
                        });
                    }
                }
            });

            seedState.loaded = true;
            seedState.inFlight = null;
            seedState.tracksSeed = tracksSeed;
            seedState.versionsCount = versionsCount;
            return tracksSeed;
        })().catch((error) => {
            seedState.inFlight = null;
            throw error;
        });
    }

    const tracksSeed = await seedState.inFlight;
    const versionsCount = getCurriculumCatalogSnapshot().versions.length;
    return {
        tracks: Array.isArray(tracksSeed) ? tracksSeed : [],
        versionsCount,
    };
}
