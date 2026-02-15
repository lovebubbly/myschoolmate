import curriculumRaw from '@/lib/curriculum.json';

type JsonObject = Record<string, unknown>;

export type GradeCategory = 'MAJOR_MANDATORY' | 'MAJOR_ELECTIVE' | 'GENERAL' | 'CROSS' | 'OTHER';

type PlanBuildOptions = {
    trackIdByKey?: TrackIdByKey;
};

export type TrackIdByKey = Record<string, number>;

export type PlanningCourse = {
    id: string;
    code: string;
    name: string;
    category: string;
    categoryCode: GradeCategory;
    creditText: string;
    creditPoints: number;
    term: string;
    year: string;
    requiredName?: string;
};

export type CurriculumApiTrack = {
    id: number;
    key: string;
    name: string;
    required: string[];
    courses: PlanningCourse[];
    missingRequired: string[];
    sourceYear: string;
    requiredCourseCount: number;
    completionYear: number;
};

export type CategorySummary = {
    categoryCode: GradeCategory;
    categoryName: string;
    requiredCredits: number;
    completedCredits: number;
    requiredCourseCount: number;
    completedCourseCount: number;
    completionRate: number;
};

export type CategoryRequirementCheck = {
    categoryCode: GradeCategory;
    categoryName: string;
    requiredCredits: number;
    completedCredits: number;
    requiredCourseCount: number;
    completedCourseCount: number;
    required: boolean;
    satisfied: boolean;
    missingCredits: number;
};

export type TrackRequirementStatus = {
    requiredCoursesSatisfied: boolean;
    categoryRequirementsSatisfied: boolean;
    overallSatisfied: boolean;
    requiredCourseCount: number;
    completedCourseCount: number;
    missingRequiredCourseNamesCount: number;
    categoryChecks: CategoryRequirementCheck[];
};

export type TrackRequirementSummary = {
    trackId: number;
    trackKey: string;
    trackName: string;
    requiredCourseCount: number;
    completedCourseCount: number;
    courseCompletionRate: number;
    missingRequiredCourseNames: string[];
    requiredCourseIds: string[];
    completionByCourseIds: string[];
    categorySummaries: CategorySummary[];
    requirementStatus: TrackRequirementStatus;
};

export type PlanningRequirementPayload = {
    academicYear: number;
    sourceYear: string;
    availableYears: number[];
    track: TrackRequirementSummary;
    courses: PlanningCourse[];
};

export type CurriculumCatalogSnapshot = {
    tracks: Record<string, { name: string; required: string[] }>;
    versions: Array<{
        academicYear: number;
        label: string;
        source: string;
        isActive: boolean;
        trackRequirements: Record<string, { requiredCourses: string[]; categoryRequirements: Partial<Record<GradeCategory, number>> }>;
    }>;
};

type YearTrackRequirement = {
    requiredCourses: string[];
    categoryRequirements: Partial<Record<GradeCategory, number>>;
};

type ParsedVersion = {
    academicYear: number;
    label: string;
    sourceYear: string;
    isActive: boolean;
    trackRequirements: Record<string, YearTrackRequirement>;
};

const CATEGORY_LABELS: Record<GradeCategory, string> = {
    MAJOR_MANDATORY: '전공 필수',
    MAJOR_ELECTIVE: '전공 선택',
    GENERAL: '교양',
    CROSS: '일반 선택',
    OTHER: '기타',
};

const DEFAULT_CATEGORY: GradeCategory = 'OTHER';
const TRACKS_RANGE = { min: 2016, max: 2025, fallback: 2025 };

function isRecord(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toInt(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Number.isInteger(value) ? value : Math.trunc(value);
    }
    if (typeof value === 'string') {
        const parsed = Number(value.trim());
        return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    }
    return null;
}

function normalizeName(value: string): string {
    return value
        .toLowerCase()
        .replace(/[()·•ㆍ]/g, '')
        .replace(/\\s+/g, '')
        .replace(/-/g, '')
        .trim();
}

function dedupeOrdered(values: string[]): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];

    values.forEach((value) => {
        const trimmed = value.trim();
        if (!trimmed || seen.has(trimmed)) return;
        seen.add(trimmed);
        ordered.push(trimmed);
    });

    return ordered;
}

function parseCategoryCode(raw: string): GradeCategory {
    const normalized = normalizeName(raw);
    if (normalized.includes('전필') || normalized.includes('전공필수')) {
        return 'MAJOR_MANDATORY';
    }
    if (normalized.includes('전선') || normalized.includes('전공선택')) {
        return 'MAJOR_ELECTIVE';
    }
    if (normalized.includes('교양')) {
        return 'GENERAL';
    }
    if (normalized.includes('일선') || normalized.includes('일반')) {
        return 'CROSS';
    }
    return DEFAULT_CATEGORY;
}

function parseCreditPoints(raw: unknown): number {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return Math.max(0, Math.round(raw));
    }
    const text = String(raw ?? '').trim();
    if (!text) return 0;
    const hasDash = text.includes('-');
    const numbers = text
        .replace(/[^0-9-]/g, '')
        .split('-')
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
    if (numbers.length === 0) return 0;
    if (!hasDash) return numbers[0];
    return numbers.reduce((acc, value) => acc + value, 0);
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item): item is string => item.length > 0);
}

function normalizeCategoryKey(raw: string): GradeCategory | null {
    const normalized = normalizeName(raw);
    if (normalized === 'major_mandatory' || normalized === 'majormandatory' || normalized.includes('전공필수')) {
        return 'MAJOR_MANDATORY';
    }
    if (normalized === 'major_elective' || normalized === 'majorelective' || normalized.includes('전공선택')) {
        return 'MAJOR_ELECTIVE';
    }
    if (normalized === 'general' || normalized.includes('교양')) {
        return 'GENERAL';
    }
    if (normalized === 'cross' || normalized === 'other' || normalized.includes('일반')) {
        return normalized.includes('일반') ? 'CROSS' : 'OTHER';
    }
    return null;
}

function getCatalogSourceYears(root: JsonObject): string[] {
    const rawYears = new Set<string>();

    const versions = isRecord(root.curriculumVersions) ? (root.curriculumVersions as JsonObject) : null;
    if (versions) {
        Object.values(versions).forEach((versionRaw) => {
            if (!isRecord(versionRaw)) return;
            const sourceYear = toInt(versionRaw.sourceYear);
            if (sourceYear !== null) {
                rawYears.add(String(sourceYear));
            }
        });
    }

    const numericTopLevelYears = Object.keys(root)
        .filter((year) => /^\d{4}$/.test(year))
        .map((year) => toInt(year))
        .filter((year): year is number => year !== null && year >= TRACKS_RANGE.min && year <= TRACKS_RANGE.max)
        .map((year) => String(year));

    numericTopLevelYears.forEach((year) => rawYears.add(year));

    const sorted = Array.from(rawYears)
        .map((year) => Number(year))
        .filter((year): year is number => Number.isFinite(year))
        .sort((a, b) => a - b)
        .map((year) => String(year));

    return sorted;
}

function getTrackIdByKey(trackIdByKey?: TrackIdByKey): TrackIdByKey {
    if (!trackIdByKey) return {};
    return trackIdByKey;
}

function parseTrackCategoryDefaults(root: JsonObject): Record<string, Partial<Record<GradeCategory, number>>> {
    const rulesRaw = isRecord(root.trackRules) ? (root.trackRules as JsonObject) : null;
    if (!rulesRaw) {
        return {};
    }

    const result: Record<string, Partial<Record<GradeCategory, number>>> = {};

    Object.entries(rulesRaw).forEach(([trackKey, ruleRaw]) => {
        if (!isRecord(ruleRaw)) return;
        const categoryRequirements = normalizeCategoryRequirements(ruleRaw.categoryRequirements);
        if (Object.keys(categoryRequirements).length > 0) {
            result[trackKey] = categoryRequirements;
        }
    });

    return result;
}

function resolveTrackKeyById(
    trackId: number,
    trackKeys: string[],
    trackIdByKey?: TrackIdByKey,
): string | null {
    const map = getTrackIdByKey(trackIdByKey);
    const directHit = Object.entries(map).find(([, mappedTrackId]) => mappedTrackId === trackId)?.[0];
    if (directHit) return directHit;

    if (!Number.isInteger(trackId) || trackId <= 0) return null;
    const targetTrackIndex = trackId - 1;
    return trackKeys[targetTrackIndex] ?? null;
}

function resolveCatalogYear(root: JsonObject, requestedSourceYear: string, availableYears: string[]): string {
    const requestedNumber = toInt(requestedSourceYear);
    if (!requestedNumber) return getCatalogSourceYears(root).slice(-1)[0] ?? TRACKS_RANGE.max.toString();

    const numericYears = availableYears
        .map((year) => toInt(year))
        .filter((year): year is number => year !== null)
        .sort((a, b) => a - b);

    if (numericYears.length === 0) {
        return String(requestedNumber);
    }

    const exact = numericYears.find((year) => year === requestedNumber);
    if (exact !== undefined) return String(exact);

    const bounded = Math.max(numericYears[0], Math.min(numericYears.at(-1) ?? requestedNumber, requestedNumber));
    const lower = [...numericYears].filter((year) => year <= bounded).at(-1);
    if (lower !== undefined) return String(lower);

    return String(numericYears[0]);
}

function parseLegacyTracks(root: JsonObject): Record<string, { name: string; required: string[] }> {
    const tracksRaw = isRecord(root.tracks) ? (root.tracks as JsonObject) : {};
    const tracks: Record<string, { name: string; required: string[] }> = {};

    Object.entries(tracksRaw).forEach(([key, raw]) => {
        if (!isRecord(raw)) return;
        tracks[key] = {
            name: typeof raw.name === 'string' ? raw.name : key,
            required: asStringArray(raw.required),
        };
    });

    return tracks;
}

function parseVersions(root: JsonObject): ParsedVersion[] {
    const legacyTracks = parseLegacyTracks(root);
    const trackRuleDefaults = parseTrackCategoryDefaults(root);
    const versionsRaw = isRecord(root.curriculumVersions) ? (root.curriculumVersions as JsonObject) : null;
    if (!versionsRaw) {
        const numericYears = Object.keys(root)
            .map((year) => toInt(year))
            .filter((year): year is number => year !== null && year >= TRACKS_RANGE.min && year <= TRACKS_RANGE.max)
            .sort((a, b) => a - b);

        return numericYears.map((year) => ({
            academicYear: year,
            label: `${year} 학번`,
            sourceYear: `${year}`,
            isActive: year === TRACKS_RANGE.max,
            trackRequirements: Object.entries(legacyTracks).reduce<Record<string, YearTrackRequirement>>((acc, [trackKey, track]) => {
                acc[trackKey] = {
                    requiredCourses: track.required,
                    categoryRequirements: trackRuleDefaults[trackKey] ?? {},
                };
                return acc;
            }, {}),
        }));
    }

    const versions: ParsedVersion[] = [];
    Object.entries(versionsRaw).forEach(([yearKey, raw]) => {
        if (!isRecord(raw)) return;
        const academicYear = toInt(raw.academicYear ?? yearKey);
        if (!academicYear) return;
        const trackRequirements = isRecord(raw.trackRequirements)
            ? (raw.trackRequirements as JsonObject)
            : {};
        const normalizedTrackRequirements: Record<string, YearTrackRequirement> = {};

        Object.entries(trackRequirements).forEach(([trackKey, trackRaw]) => {
            if (!isRecord(trackRaw)) return;
            const required = asStringArray(trackRaw.requiredCourses)
                .length
                ? asStringArray(trackRaw.requiredCourses)
                : asStringArray(trackRaw.requiredCourseNames);
            const fallback = required.length > 0 ? required : asStringArray(legacyTracks[trackKey]?.required);
            const categoryDefaults = trackRuleDefaults[trackKey] ?? {};
            const explicitRequirements = normalizeCategoryRequirements(trackRaw.categoryRequirements);
            const mergedRequirements = { ...categoryDefaults, ...explicitRequirements };
            normalizedTrackRequirements[trackKey] = {
                requiredCourses: fallback,
                categoryRequirements: mergedRequirements,
            };
        });

        Object.entries(legacyTracks).forEach(([trackKey, track]) => {
            if (!normalizedTrackRequirements[trackKey]) {
                normalizedTrackRequirements[trackKey] = {
                    requiredCourses: track.required,
                    categoryRequirements: trackRuleDefaults[trackKey] ?? {},
                };
            }
        });

        versions.push({
            academicYear,
            label: typeof raw.label === 'string' ? raw.label : `${academicYear} 학번`,
            sourceYear: `${toInt(raw.sourceYear) || yearKey}`,
            isActive: Boolean(raw.isActive),
            trackRequirements: normalizedTrackRequirements,
        });
    });

    return versions.sort((a, b) => a.academicYear - b.academicYear);
}

function extractCourses(yearData: unknown, yearKey: string): PlanningCourse[] {
    if (!isRecord(yearData)) return [];
    return Object.entries(yearData)
        .filter(([semester]) => /^\d-\d$/.test(semester))
        .flatMap(([, rawCourses]) => {
            if (!Array.isArray(rawCourses)) return [];
            return rawCourses
                .map((rawCourse): PlanningCourse | null => {
                    if (!isRecord(rawCourse)) return null;
                    const code = String(rawCourse.code || '').trim();
                    const name = String(rawCourse.name || '').trim();
                    const type = String(rawCourse.type || '전공').trim();
                    const creditRaw = rawCourse.credit;

                    if (!code || !name) return null;
                    const creditText = typeof creditRaw === 'number'
                        ? `${creditRaw}학점`
                        : String(creditRaw || '-');
                    return {
                        id: code,
                        code,
                        name,
                        category: type,
                        categoryCode: parseCategoryCode(type),
                        creditText,
                        creditPoints: parseCreditPoints(creditText),
                        term: '',
                        year: yearKey,
                    };
                })
                .filter((item): item is PlanningCourse => Boolean(item));
        });
}

function resolveClosestVersion(versions: ParsedVersion[], requestedYear: number | null): ParsedVersion {
    if (versions.length === 0) {
        throw new Error('No curriculum version data found.');
    }
    if (!requestedYear) return versions.at(-1)!;
    const years = versions.map((v) => v.academicYear).sort((a, b) => a - b);
    const bounded = Math.max(TRACKS_RANGE.min, Math.min(TRACKS_RANGE.max, requestedYear));
    if (years.includes(bounded)) return versions.find((v) => v.academicYear === bounded)!;

    const lower = [...years].filter((year) => year <= bounded).at(-1);
    if (lower !== undefined) return versions.find((v) => v.academicYear === lower)!;
    return versions.find((v) => v.academicYear === years[0])!;
}

function mapRequiredCourses(requiredCourseNames: string[], allCourses: PlanningCourse[]): {
    requiredCourseIds: string[];
    requiredCourses: PlanningCourse[];
    missingRequiredCourseNames: string[];
} {
    const uniqueRequiredCourseNames = dedupeOrdered(requiredCourseNames);
    const normalizedMap = new Map<string, PlanningCourse>();
    allCourses.forEach((course) => normalizedMap.set(normalizeName(course.name), course));
    const used = new Set<string>();

    const requiredCourseIds: string[] = [];
    const requiredCourses: PlanningCourse[] = [];
    const missingRequiredCourseNames: string[] = [];

    uniqueRequiredCourseNames.forEach((requiredName) => {
        const normalizedRequired = normalizeName(requiredName);
        const exactMatch = normalizedMap.get(normalizedRequired);
        let candidate = !exactMatch || used.has(exactMatch.id) ? undefined : exactMatch;

        if (!candidate) {
            candidate = allCourses.find((course) => {
                const normalizedCourse = normalizeName(course.name);
                if (used.has(course.id)) return false;
                return (
                    normalizedCourse.includes(normalizedRequired) ||
                    normalizedRequired.includes(normalizedCourse)
                );
            });
        }

        if (!candidate) {
            if (exactMatch && !used.has(exactMatch.id)) {
                used.add(exactMatch.id);
                requiredCourseIds.push(exactMatch.id);
                requiredCourses.push({ ...exactMatch, requiredName });
                return;
            }
            missingRequiredCourseNames.push(requiredName);
            return;
        }

        used.add(candidate.id);
        requiredCourseIds.push(candidate.id);
        requiredCourses.push({
            ...candidate,
            requiredName,
        });
    });

    return { requiredCourseIds, requiredCourses, missingRequiredCourseNames };
}

function normalizeCategoryRequirements(rawRequirements: unknown): Partial<Record<GradeCategory, number>> {
    const normalized: Partial<Record<GradeCategory, number>> = {};

    if (!isRecord(rawRequirements)) return normalized;

    Object.entries(rawRequirements).forEach(([rawCode, rawValue]) => {
        const code = normalizeCategoryKey(rawCode);
        if (!code) return;
        const value = toInt(rawValue);
        if (!value || value <= 0) return;
        normalized[code] = value;
    });

    return normalized;
}

function resolveCategoryRequirements(
    rawRequirements: Partial<Record<GradeCategory, number>>,
    requiredCourseIds: string[],
    catalogCourses: PlanningCourse[],
): Partial<Record<GradeCategory, number>> {
    const explicitRequirements = normalizeCategoryRequirements(rawRequirements);
    if (Object.keys(explicitRequirements).length > 0) {
        return explicitRequirements;
    }

    const derived: Partial<Record<GradeCategory, number>> = {};
    const courseById = new Map<string, PlanningCourse>(catalogCourses.map((course) => [course.id, course]));

    requiredCourseIds.forEach((courseId) => {
        const course = courseById.get(courseId);
        if (!course) return;
        const categoryCode = course.categoryCode;
        derived[categoryCode] = (derived[categoryCode] ?? 0) + Math.max(0, course.creditPoints);
    });

    return derived;
}

function buildCategoryRequirementChecks(
    categorySummaries: CategorySummary[],
    explicitRequirements: Partial<Record<GradeCategory, number>>,
): CategoryRequirementCheck[] {
    const explicitByCategory = explicitRequirements;
    return categorySummaries.map((summary) => {
        const explicitRequiredCredits = explicitByCategory[summary.categoryCode];
        const requiredCredits = explicitRequiredCredits ?? summary.requiredCredits;
        const requiredCourseCount = summary.requiredCourseCount;
        const completedCourseCount = summary.completedCourseCount;
        const required = requiredCredits > 0 || requiredCourseCount > 0;
        const completedCredits = summary.completedCredits;
        const satisfied = !required
            ? true
            : completedCredits >= requiredCredits;
        const missingCredits = required ? Math.max(0, requiredCredits - completedCredits) : 0;

        return {
            categoryCode: summary.categoryCode,
            categoryName: summary.categoryName,
            requiredCredits,
            completedCredits,
            requiredCourseCount,
            completedCourseCount,
            required,
            satisfied,
            missingCredits,
        };
    });
}

function buildRequirementStatus(
    requiredCourseCount: number,
    completedCourseCount: number,
    missingRequiredCourseNames: string[],
    categorySummaries: CategorySummary[],
    explicitRequirements: Partial<Record<GradeCategory, number>>,
): TrackRequirementStatus {
    const categoryChecks = buildCategoryRequirementChecks(categorySummaries, explicitRequirements);
    const requiredCoursesSatisfied = completedCourseCount >= requiredCourseCount && missingRequiredCourseNames.length === 0;
    const categoryRequirementsSatisfied = categoryChecks.every((check) => check.satisfied);

    return {
        requiredCoursesSatisfied,
        categoryRequirementsSatisfied,
        overallSatisfied: requiredCoursesSatisfied && categoryRequirementsSatisfied,
        requiredCourseCount,
        completedCourseCount,
        missingRequiredCourseNamesCount: missingRequiredCourseNames.length,
        categoryChecks,
    };
}

function buildCategorySummaries(
    courses: PlanningCourse[],
    requiredCourseIds: string[],
    completedCourseIds: string[],
    explicitRequirements: Partial<Record<GradeCategory, number>>,
): CategorySummary[] {
    const requiredSet = new Set(requiredCourseIds);
    const completedSet = new Set(completedCourseIds);

    const requiredByCategory: Record<GradeCategory, { requiredCredits: number; requiredCourseCount: number }> = {
        MAJOR_MANDATORY: { requiredCredits: 0, requiredCourseCount: 0 },
        MAJOR_ELECTIVE: { requiredCredits: 0, requiredCourseCount: 0 },
        GENERAL: { requiredCredits: 0, requiredCourseCount: 0 },
        CROSS: { requiredCredits: 0, requiredCourseCount: 0 },
        OTHER: { requiredCredits: 0, requiredCourseCount: 0 },
    };
    const completedByCategory: Record<GradeCategory, number> = {
        MAJOR_MANDATORY: 0,
        MAJOR_ELECTIVE: 0,
        GENERAL: 0,
        CROSS: 0,
        OTHER: 0,
    };
    const completedCourseCount: Record<GradeCategory, number> = {
        MAJOR_MANDATORY: 0,
        MAJOR_ELECTIVE: 0,
        GENERAL: 0,
        CROSS: 0,
        OTHER: 0,
    };

    courses.forEach((course) => {
        const categoryCode = course.categoryCode;
        if (requiredSet.has(course.id)) {
            requiredByCategory[categoryCode].requiredCourseCount += 1;
            requiredByCategory[categoryCode].requiredCredits += course.creditPoints;
            if (completedSet.has(course.id)) {
                completedByCategory[categoryCode] += course.creditPoints;
                completedCourseCount[categoryCode] += 1;
            }
        }
    });

    return (Object.keys(CATEGORY_LABELS) as GradeCategory[]).map((categoryCode) => {
        const requiredCreditsFromRule = explicitRequirements[categoryCode];
        const requiredCredits = requiredCreditsFromRule != null && requiredCreditsFromRule > 0
            ? requiredCreditsFromRule
            : requiredByCategory[categoryCode].requiredCredits;
        const requiredCount = requiredByCategory[categoryCode].requiredCourseCount;
        const completedCredits = completedByCategory[categoryCode];
        const completionRate = requiredCredits > 0
            ? Math.min(100, (completedCredits / requiredCredits) * 100)
            : requiredCount > 0
                ? 0
                : 0;

        return {
            categoryCode,
            categoryName: CATEGORY_LABELS[categoryCode],
            requiredCredits,
            completedCredits,
            requiredCourseCount: requiredCount,
            completedCourseCount: completedCourseCount[categoryCode],
            completionRate,
        };
    });
}

export function resolveCurriculumYearRange(): { min: number; max: number; years: number[] } {
    const versions = parseVersions(curriculumRaw as JsonObject);
    const years = versions.map((v) => v.academicYear).sort((a, b) => a - b);
    return {
        min: years[0] ?? TRACKS_RANGE.min,
        max: years.at(-1) ?? TRACKS_RANGE.max,
        years,
    };
}

export function getCurriculumCatalogSnapshot(): CurriculumCatalogSnapshot {
    const root = curriculumRaw as JsonObject;
    const tracks = parseLegacyTracks(root);
    const availableYears = getCatalogSourceYears(root);
    const versions = parseVersions(root).map((version) => ({
        academicYear: version.academicYear,
        label: version.label,
        source: version.sourceYear,
        isActive: version.isActive,
        trackRequirements: Object.entries(version.trackRequirements).reduce((acc, [trackKey, trackRequirement]) => {
            const versionSourceYear = resolveCatalogYear(root, version.sourceYear, availableYears);
            const catalogCourses = extractCourses(root[versionSourceYear], versionSourceYear);
            const { requiredCourseIds } = mapRequiredCourses(trackRequirement.requiredCourses, catalogCourses);
            const resolvedCategoryRequirements = resolveCategoryRequirements(
                trackRequirement.categoryRequirements,
                requiredCourseIds,
                catalogCourses,
            );
            acc[trackKey] = {
                requiredCourses: dedupeOrdered(trackRequirement.requiredCourses),
                categoryRequirements: resolvedCategoryRequirements,
            };
            return acc;
        }, {} as Record<string, { requiredCourses: string[]; categoryRequirements: Partial<Record<GradeCategory, number>> }>),
    }));

    return { tracks, versions };
}

export function buildPlanForTrack(
    trackId: number,
    options: {
        requestedYear?: number | null;
        completedCourseIds?: string[];
        profileCohortYear?: number | null;
        profileGrade?: number | null;
        trackIdByKey?: TrackIdByKey;
    } = {},
): PlanningRequirementPayload {
    const root = curriculumRaw as JsonObject;
    const versions = parseVersions(root);
    if (versions.length === 0) {
        throw new Error('No curriculum version metadata found.');
    }

    const allCatalogYears = getCatalogSourceYears(root);
    const tracks = parseLegacyTracks(root);
    const trackKeys = Object.keys(tracks);
    const targetTrackKey = resolveTrackKeyById(trackId, trackKeys, options.trackIdByKey);
    if (!targetTrackKey) {
        throw new Error(`Track not found: ${trackId}`);
    }

    let requestedYear = options.requestedYear ?? options.profileCohortYear ?? null;
    if (!requestedYear && options.profileGrade) {
        requestedYear = Math.max(TRACKS_RANGE.min, Math.min(TRACKS_RANGE.max, new Date().getFullYear() - options.profileGrade + 1));
    }
    if (!requestedYear) {
        requestedYear = TRACKS_RANGE.fallback;
    }

    const version = resolveClosestVersion(versions, requestedYear);
    const trackReq = version.trackRequirements[targetTrackKey];
    if (!trackReq) {
        throw new Error(`Track requirement not found: ${targetTrackKey}`);
    }

    const catalogYear = resolveCatalogYear(root, version.sourceYear, allCatalogYears);
    const catalogCourses = extractCourses(root[catalogYear], catalogYear);
    const requiredCourseNames = dedupeOrdered(trackReq.requiredCourses);
    const { requiredCourseIds, requiredCourses, missingRequiredCourseNames } = mapRequiredCourses(requiredCourseNames, catalogCourses);
    const requiredCourseCount = requiredCourseNames.length;
    const resolvedCategoryRequirements = resolveCategoryRequirements(
        trackReq.categoryRequirements,
        requiredCourseIds,
        catalogCourses,
    );

    const completionByCourseIds = Array.from(new Set(options.completedCourseIds ?? [])).filter((id) => id);
    const completionSet = new Set(completionByCourseIds);
    const requiredCompleted = requiredCourseIds.filter((id) => completionSet.has(id));
    const categorySummaries = buildCategorySummaries(
        catalogCourses,
        requiredCourseIds,
        completionByCourseIds,
        resolvedCategoryRequirements,
    );
    const completionRate = requiredCourseCount > 0 ? (requiredCompleted.length / requiredCourseCount) * 100 : 0;
    const requirementStatus = buildRequirementStatus(
        requiredCourseCount,
        requiredCompleted.length,
        missingRequiredCourseNames,
        categorySummaries,
        trackReq.categoryRequirements,
    );

    const track = tracks[targetTrackKey];
    const resolvedTrackId = getTrackIdByKey(options.trackIdByKey)[targetTrackKey] || trackId;
    const courses = catalogCourses
        .filter((course) => requiredCourseIds.includes(course.id))
        .map((course) => ({
            ...course,
            requiredName: requiredCourses.find((requiredCourse) => requiredCourse.id === course.id)?.requiredName,
        }));

    return {
        academicYear: version.academicYear,
        sourceYear: catalogYear,
        availableYears: versions.map((v) => v.academicYear).sort((a, b) => a - b),
        track: {
            trackId: resolvedTrackId,
            trackKey: targetTrackKey,
            trackName: track.name || targetTrackKey,
            requiredCourseCount,
            completedCourseCount: requiredCompleted.length,
            courseCompletionRate: Math.round(completionRate),
            missingRequiredCourseNames,
            requiredCourseIds,
            completionByCourseIds,
            categorySummaries,
            requirementStatus,
        },
        courses,
    };
}

export function buildTracksForYear(
    requestedYear: number | null,
    options: PlanBuildOptions = {},
): { tracks: CurriculumApiTrack[]; academicYear: number; sourceYear: string; availableYears: number[] } {
    const root = curriculumRaw as JsonObject;
    const versions = parseVersions(root);
    if (versions.length === 0) {
        throw new Error('No curriculum version metadata found.');
    }
    const range = versions.map((v) => v.academicYear).sort((a, b) => a - b);
    const version = resolveClosestVersion(versions, requestedYear);
    const tracks = parseLegacyTracks(root);
    const allCatalogYears = getCatalogSourceYears(root);
    const catalogYear = resolveCatalogYear(root, version.sourceYear, allCatalogYears);
    const catalogCourses = extractCourses(root[catalogYear], catalogYear);

    const mappedTracks: CurriculumApiTrack[] = Object.entries(tracks).map(([trackKey, trackValue], index) => {
        const trackReq = version.trackRequirements[trackKey] ?? { requiredCourses: trackValue.required, categoryRequirements: {} };
        const requiredCourseNames = dedupeOrdered(trackReq.requiredCourses);
        const { requiredCourseIds, requiredCourses, missingRequiredCourseNames } = mapRequiredCourses(requiredCourseNames, catalogCourses);

        const courses = requiredCourseIds
            .map((courseId) => catalogCourses.find((course) => course.id === courseId))
            .filter((course): course is PlanningCourse => Boolean(course))
            .map((course) => ({
                ...course,
                requiredName: requiredCourses.find((requiredCourse) => requiredCourse.id === course.id)?.requiredName,
            }));

        return {
            id: getTrackIdByKey(options.trackIdByKey)[trackKey] || index + 1,
            key: trackKey,
            name: trackValue.name || trackKey,
            required: trackReq.requiredCourses,
            courses,
            missingRequired: missingRequiredCourseNames,
            sourceYear: catalogYear,
            requiredCourseCount: requiredCourseNames.length,
            completionYear: version.academicYear,
        };
    });

    return {
        tracks: mappedTracks,
        academicYear: version.academicYear,
        sourceYear: catalogYear,
        availableYears: range,
    };
}
