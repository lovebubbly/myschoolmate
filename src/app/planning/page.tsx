'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import type {
    CategorySummary,
    PlanningCourse,
    PlanningRequirementPayload,
    CategoryRequirementCheck,
    TrackRequirementStatus,
} from '@/lib/planningRequirements';

interface Profile {
    grade?: number;
    trackId?: number | null;
    cohortYear?: number | null;
}

interface CurriculumTrack {
    id: number;
    key: string;
    name: string;
    required: string[];
    courses: PlanningCourse[];
    missingRequired: string[];
    sourceYear: string;
    requiredCourseCount: number;
    completionYear: number;
}

interface CurriculumResponse {
    success: boolean;
    tracks: CurriculumTrack[];
    academicYear: number;
    sourceYear: string;
    availableYears: number[];
}

interface ProgressSavePayload {
    trackId: number;
    completedCourseIds: string[];
}

interface TrackCompletionStore {
    [trackId: string]: string[];
}

type GradeCategory = PlanningCourse['categoryCode'];

type ActiveTrackSummary = {
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

const LEGACY_COMPLETION_STORAGE_KEY = 'myschoolmate-planning-completed-courses-v1';
const CATEGORY_ORDER: GradeCategory[] = ['MAJOR_MANDATORY', 'MAJOR_ELECTIVE', 'GENERAL', 'CROSS', 'OTHER'];

function toUniqueCourseIds(values: unknown): string[] {
    if (!Array.isArray(values)) return [];

    const normalized = values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value): value is string => value.length > 0);

    return Array.from(new Set(normalized));
}

function normalizeTrackCompletionStore(raw: unknown): TrackCompletionStore {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

    const source = raw as Record<string, unknown>;
    const normalized: TrackCompletionStore = {};

    Object.entries(source).forEach(([trackId, courseIds]) => {
        normalized[trackId] = toUniqueCourseIds(courseIds);
    });

    return normalized;
}

function readLegacyCompletionStore(): TrackCompletionStore {
    if (typeof window === 'undefined') return {};

    try {
        const raw = window.localStorage.getItem(LEGACY_COMPLETION_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return normalizeTrackCompletionStore(parsed);
    } catch {
        return {};
    }
}

function formatCategoryLabel(categoryCode: string): string {
    switch (categoryCode) {
        case 'MAJOR_MANDATORY':
            return '전공 필수';
        case 'MAJOR_ELECTIVE':
            return '전공 선택';
        case 'GENERAL':
            return '교양';
        case 'CROSS':
            return '일반 선택';
        default:
            return '기타';
    }
}

function buildCategorySummariesForProgress(
    courses: PlanningCourse[],
    requiredCourseIds: string[],
    completedCourseIds: string[],
    previousSummaries: CategorySummary[],
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
    const completedCourseCountByCategory: Record<GradeCategory, number> = {
        MAJOR_MANDATORY: 0,
        MAJOR_ELECTIVE: 0,
        GENERAL: 0,
        CROSS: 0,
        OTHER: 0,
    };

    courses.forEach((course) => {
        if (!requiredSet.has(course.id)) return;
        const categoryCode = course.categoryCode;
        requiredByCategory[categoryCode].requiredCourseCount += 1;
        requiredByCategory[categoryCode].requiredCredits += course.creditPoints;
        if (completedSet.has(course.id)) {
            completedByCategory[categoryCode] += course.creditPoints;
            completedCourseCountByCategory[categoryCode] += 1;
        }
    });

    const explicitRequiredCredits = Object.fromEntries(
        previousSummaries
            .filter((summary) => summary.requiredCredits > 0)
            .map((summary) => [summary.categoryCode, summary.requiredCredits]),
    ) as Partial<Record<GradeCategory, number>>;

    return CATEGORY_ORDER.map((categoryCode) => {
        const requiredCreditsFromRule = explicitRequiredCredits[categoryCode] ?? 0;
        const required = requiredCreditsFromRule > 0 ? requiredCreditsFromRule : requiredByCategory[categoryCode].requiredCredits;
        const completedCredits = completedByCategory[categoryCode];
        const completionRate = required > 0
            ? Math.min(100, (completedCredits / required) * 100)
            : requiredByCategory[categoryCode].requiredCourseCount > 0
                ? 0
                : 0;

        return {
            categoryCode,
            categoryName: formatCategoryLabel(categoryCode),
            requiredCredits: required,
            completedCredits,
            requiredCourseCount: requiredByCategory[categoryCode].requiredCourseCount,
            completedCourseCount: completedCourseCountByCategory[categoryCode],
            completionRate,
        };
    });
}

function requirementStatusPillClass(isSatisfied: boolean): string {
    return isSatisfied
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : 'border-amber-200 bg-amber-50 text-amber-900';
}

function requirementStatusLabel(isSatisfied: boolean, doneLabel: string, todoLabel: string): string {
    return isSatisfied ? doneLabel : todoLabel;
}

function buildActiveSummary(
    requirement: PlanningRequirementPayload | null,
    trackCourses: PlanningCourse[],
    trackCompletionCourseIds: string[],
): ActiveTrackSummary | null {
    if (!requirement) return null;

    const requiredCourseIds = requirement.track.requiredCourseIds;
    const requiredCompletedCount = requiredCourseIds.filter((id) => trackCompletionCourseIds.includes(id)).length;
    const requiredCount = requirement.track.requiredCourseCount || 0;
    const categorySummaries = buildCategorySummariesForProgress(
        trackCourses,
        requiredCourseIds,
        trackCompletionCourseIds,
        requirement.track.categorySummaries,
    );
    const courseCompletionRate = requiredCount > 0 ? Math.round((requiredCompletedCount / requiredCount) * 100) : 0;

    return {
        ...requirement.track,
        completionByCourseIds: trackCompletionCourseIds,
        completedCourseCount: requiredCompletedCount,
        courseCompletionRate,
        requirementStatus: requirement.track.requirementStatus,
        categorySummaries,
    };
}

function resolveAcademicYear(profile: Profile): number {
    const yearFromCohort = profile.cohortYear;
    if (yearFromCohort) return yearFromCohort;

    if (profile.grade && profile.grade > 0) {
        const fallback = new Date().getFullYear() - profile.grade + 1;
        return Math.max(2016, Math.min(2025, fallback));
    }

    return 2025;
}

export default function Planning() {
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [tracks, setTracks] = useState<CurriculumTrack[]>([]);
    const [trackCompletionMap, setTrackCompletionMap] = useState<TrackCompletionStore>({});
    const [requirement, setRequirement] = useState<PlanningRequirementPayload | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const currentTrack = profile?.trackId ? tracks.find((track) => track.id === profile.trackId) : undefined;
    const trackCourses = useMemo<PlanningCourse[]>(() => requirement?.courses || currentTrack?.courses || [], [requirement?.courses, currentTrack?.courses]);

    const trackCompletionCourseIds = useMemo(() => {
        if (!requirement) return [];

        const trackKey = String(requirement.track.trackId);
        const hasLocalState = Object.prototype.hasOwnProperty.call(trackCompletionMap, trackKey);
        const completed = hasLocalState
            ? trackCompletionMap[trackKey] || []
            : requirement.track.completionByCourseIds;

        const validSet = new Set(trackCourses.map((course) => course.id));
        return completed.filter((courseId) => validSet.has(courseId));
    }, [requirement, trackCompletionMap, trackCourses]);

    const activeSummary = useMemo(
        () => buildActiveSummary(requirement, trackCourses, trackCompletionCourseIds),
        [requirement, trackCourses, trackCompletionCourseIds],
    );
    const completionRate = activeSummary?.courseCompletionRate ?? 0;

    const syncTrackCompletion = useCallback(async (payload: ProgressSavePayload, options?: { silent?: boolean }) => {
        try {
            if (!options?.silent) {
                setIsSaving(true);
                setSaveError(null);
            }

            const res = await fetch('/api/planning/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || '진행 상태 저장에 실패했습니다.');
            }

            const completionByTrack = normalizeTrackCompletionStore(data.completionByTrack);
            if (completionByTrack && Object.keys(completionByTrack).length > 0) {
                setTrackCompletionMap((prev) => ({
                    ...prev,
                    ...completionByTrack,
                }));
            }
        } catch (error) {
            if (!options?.silent) {
                console.error('Failed to sync planning progress:', error);
                setSaveError('진행 상태 저장에 실패했습니다. 네트워크 상태를 확인하고 다시 시도하세요.');
            }
        } finally {
            if (!options?.silent) {
                setIsSaving(false);
            }
        }
    }, []);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        setSaveError(null);

        try {
            const profileRes = await fetch('/api/user/profile', { cache: 'no-store' });
            let nextProfile: Profile | null = null;
            if (profileRes.ok) {
                const profileJson = await profileRes.json();
                if (profileJson?.success) {
                    nextProfile = profileJson.profile || null;
                }
            }

            if (!profileRes.ok || !nextProfile) {
                setLoadError('사용자 프로필을 불러오지 못했습니다.');
                setProfile(null);
                setIsLoading(false);
                return;
            }

            setProfile(nextProfile);
            const academicYear = resolveAcademicYear(nextProfile);
            const curriculumRes = await fetch(`/api/curriculum?academicYear=${academicYear}`);

            if (!curriculumRes.ok) {
                setLoadError('커리큘럼 요청이 실패했습니다.');
                setIsLoading(false);
                return;
            }

            const curriculumJson = (await curriculumRes.json()) as CurriculumResponse;
            if (!curriculumJson.success) {
                setLoadError('커리큘럼 데이터를 불러오지 못했습니다.');
                setIsLoading(false);
                return;
            }
            setTracks(curriculumJson.tracks || []);

            let nextTrackCompletionMap: TrackCompletionStore = normalizeTrackCompletionStore({});
            setRequirement(null);
            if (nextProfile.trackId) {
                const reqRes = await fetch(`/api/planning/requirements?trackId=${nextProfile.trackId}&academicYear=${academicYear}`);
                if (reqRes.ok) {
                    const reqJson = await reqRes.json();
                    if (reqJson?.success) {
                        setRequirement(reqJson as PlanningRequirementPayload);
                        const map = normalizeTrackCompletionStore(reqJson.completionByTrack);
                        if (Object.keys(map).length > 0) {
                            nextTrackCompletionMap = map;
                        }
                    }
                }
            }

            if (Object.keys(nextTrackCompletionMap).length === 0) {
                const progressRes = await fetch('/api/planning/progress');
                if (progressRes.ok) {
                    const progressJson = await progressRes.json();
                    if (progressJson?.success) {
                        nextTrackCompletionMap = normalizeTrackCompletionStore(progressJson.completionByTrack);
                    }
                }
            }

            const legacyStore = readLegacyCompletionStore();
            const legacyTrackKey = nextProfile.trackId ? String(nextProfile.trackId) : '';
            const legacyCourseIds = toUniqueCourseIds(legacyStore[legacyTrackKey]);

            if (legacyCourseIds.length > 0 && nextProfile.trackId) {
                const merged = Array.from(new Set([...(nextTrackCompletionMap[legacyTrackKey] || []), ...legacyCourseIds]));
                nextTrackCompletionMap[legacyTrackKey] = merged;

                void syncTrackCompletion({
                    trackId: nextProfile.trackId,
                    completedCourseIds: merged,
                }, { silent: true });
            }

            setTrackCompletionMap(nextTrackCompletionMap);
        } catch (error) {
            console.error('Failed to load planning data:', error);
            setLoadError('페이지 초기화에 실패했습니다. 잠시 후 다시 시도하세요.');
        } finally {
            setIsLoading(false);
        }
    }, [syncTrackCompletion]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const toggleCourse = (courseId: string) => {
        if (!profile?.trackId) return;

        const key = String(profile.trackId);
        let nextCourseIds: string[] = [];

        setTrackCompletionMap((prev) => {
            const prevSet = new Set(prev[key] || []);
            if (prevSet.has(courseId)) {
                prevSet.delete(courseId);
            } else {
                prevSet.add(courseId);
            }
            nextCourseIds = Array.from(prevSet);
            return {
                ...prev,
                [key]: nextCourseIds,
            };
        });

        void syncTrackCompletion({ trackId: profile.trackId, completedCourseIds: nextCourseIds });
    };

    const resetProgress = () => {
        if (!profile?.trackId) return;

        const key = String(profile.trackId);
        setTrackCompletionMap((prev) => ({
            ...prev,
            [key]: [],
        }));

        void syncTrackCompletion({ trackId: profile.trackId, completedCourseIds: [] });
    };

    if (isLoading) return <div className="p-8 text-sm text-muted-foreground">로딩 중...</div>;
    if (loadError && !profile) {
        return (
            <div className="p-8 space-y-3">
                <p className="text-destructive">{loadError}</p>
                <Button onClick={() => void loadData()}>다시 시도</Button>
            </div>
        );
    }

    if (!profile) return <div className="p-8 text-sm text-muted-foreground">로딩 중...</div>;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 pt-20 md:pt-28 font-sans text-foreground">
            <main className="max-w-3xl mx-auto space-y-6">
                <header className="flex items-center gap-4">
                    <Button asChild variant="ghost" size="icon" className="-ml-2">
                        <Link href="/" aria-label="대시보드로 돌아가기">
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">커리큘럼 플래너</h1>
                </header>

                {loadError && (
                    <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-[16px]">
                        {loadError}
                    </p>
                )}

                {!currentTrack ? (
                    <Card className="p-8 text-center rounded-[24px] space-y-4">
                        <p className="text-gray-500">선택된 트랙이 없습니다.</p>
                        <Button asChild>
                            <Link href="/settings">트랙 설정하러 가기</Link>
                        </Button>
                    </Card>
                ) : (
                <div className="space-y-6">
                        <div className="bg-blue-600 text-white p-6 rounded-[24px] shadow-lg shadow-blue-200">
                            <h2 className="text-lg opacity-80 font-medium mb-1">나의 트랙</h2>
                            <h1 className="text-3xl font-bold">{currentTrack.name}</h1>
                            <p className="mt-4 opacity-90 text-sm leading-relaxed">
                                필수 과목 {activeSummary?.requiredCourseCount ?? currentTrack.requiredCourseCount}개 /
                                {' '}매핑 {trackCourses.length}개 / 완료 {trackCompletionCourseIds.length}개
                                {requirement ? ` (기준 학번: ${requirement.academicYear}, 과목 기준: ${requirement.sourceYear})` : ` (기준 연도: ${currentTrack.sourceYear})`}
                            </p>
                            <div className="mt-4 space-y-2">
                                <div className="flex justify-between text-xs opacity-80">
                                    <span>과목 완료율</span>
                                    <span>{Math.round(completionRate)}%</span>
                                </div>
                                <Progress value={completionRate} className="h-2 bg-white/20" />
                            </div>
                            <div className="mt-3 text-xs">
                                {isSaving ? (
                                    <span className="text-blue-100">진행 상태를 계정에 저장 중입니다.</span>
                                ) : saveError ? (
                                    <span className="text-amber-100">저장 실패: {saveError}</span>
                                ) : (
                                <span className="text-emerald-100">계정 기반으로 진행 상태가 동기화됩니다.</span>
                                )}
                            </div>
                            {activeSummary?.requirementStatus ? (
                                <div className="mt-4 space-y-2">
                                    <p className="text-xs font-semibold">졸업 요건 상태</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                        <p className={`rounded-full border px-3 py-2 ${requirementStatusPillClass(activeSummary.requirementStatus.requiredCoursesSatisfied)}`}>
                                            필수과목: {requirementStatusLabel(activeSummary.requirementStatus.requiredCoursesSatisfied, '충족', '미충족')}
                                        </p>
                                        <p className={`rounded-full border px-3 py-2 ${requirementStatusPillClass(activeSummary.requirementStatus.categoryRequirementsSatisfied)}`}>
                                            카테고리 규칙: {requirementStatusLabel(activeSummary.requirementStatus.categoryRequirementsSatisfied, '충족', '미충족')}
                                        </p>
                                        <p className={`rounded-full border px-3 py-2 ${requirementStatusPillClass(activeSummary.requirementStatus.overallSatisfied)}`}>
                                            전체 졸업요건: {requirementStatusLabel(activeSummary.requirementStatus.overallSatisfied, '충족', '미충족')}
                                        </p>
                                    </div>
                                </div>
                            ) : null}
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={resetProgress}
                                disabled={trackCompletionCourseIds.length === 0 || isSaving}
                                className="mt-4 bg-white/20 text-white hover:bg-white/30"
                            >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                체크 초기화
                            </Button>
                        </div>

                        <Card className="p-5 rounded-[20px] bg-white border border-gray-200">
                            <p className="font-bold text-sm mb-3">카테고리별 학점 충족률</p>
                            {activeSummary?.categorySummaries?.length ? (
                                <div className="space-y-3">
                                    {activeSummary.categorySummaries
                                        .filter((summary) => summary.requiredCourseCount > 0 || summary.requiredCredits > 0)
                                        .map((summary) => {
                                            const completedRate = Math.round(summary.completionRate);
                                            const requirementCheck = activeSummary.requirementStatus?.categoryChecks?.find(
                                                (check: CategoryRequirementCheck) => check.categoryCode === summary.categoryCode,
                                            );
                                            const checkLabel = requirementCheck?.required
                                                ? requirementCheck.satisfied
                                                    ? '요건 충족'
                                                    : `${Math.max(0, requirementCheck.missingCredits)}학점 미달`
                                                : '요건 미설정';
                                            const checkClass = requirementCheck?.required
                                                ? requirementCheck.satisfied
                                                    ? 'text-emerald-600'
                                                    : 'text-amber-600'
                                                : 'text-gray-500';

                                            return (
                                                <div key={summary.categoryCode} className="space-y-1">
                                                    <div className="flex justify-between items-center text-xs text-gray-700">
                                                        <span>{formatCategoryLabel(summary.categoryCode)} / {summary.completedCourseCount}/{summary.requiredCourseCount}</span>
                                                        <span className={checkClass}>
                                                            {summary.completedCredits} / {summary.requiredCredits}학점 ({completedRate}%)
                                                            {` · ${checkLabel}`}
                                                        </span>
                                                    </div>
                                                    <Progress value={completedRate} className="h-2" />
                                                </div>
                                            );
                                        })}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500">카테고리 규칙 데이터가 아직 준비되지 않았습니다.</p>
                            )}
                        </Card>

                        {activeSummary && activeSummary.missingRequiredCourseNames.length > 0 ? (
                                <Card className="p-5 rounded-[20px] bg-amber-50 border-amber-200 text-amber-900">
                                    <p className="font-bold text-sm mb-2">
                                        누락된 필수 과목 {activeSummary.missingRequiredCourseNames.length}개
                                    </p>
                                    <ul className="list-disc pl-5 text-xs leading-relaxed space-y-1">
                                        {activeSummary.missingRequiredCourseNames.map((name) => (
                                            <li key={name}>{name}</li>
                                        ))}
                                    </ul>
                            </Card>
                        ) : (
                            <Card className="p-5 rounded-[20px] border border-emerald-200 text-emerald-900 bg-emerald-50">
                                <p className="font-bold text-sm">
                                    모든 필수 과목을 매핑했습니다. 과목 체크만 남았습니다.
                                </p>
                            </Card>
                        )}

                        <div className="grid gap-3">
                            {trackCourses.length === 0 ? (
                                <p className="text-center text-gray-400 py-10">현재 트랙의 매핑된 과목 정보가 없습니다.</p>
                            ) : (
                                trackCourses.map((course) => {
                                    const isCompleted = trackCompletionCourseIds.includes(course.id);
                                    return (
                                        <label
                                            key={course.id}
                                            htmlFor={`course-${course.id}`}
                                            className={`bg-white p-5 rounded-[20px] shadow-sm flex justify-between items-center gap-4 min-h-[88px] cursor-pointer ${isCompleted ? 'border border-emerald-100 bg-emerald-50/40' : ''}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <Checkbox
                                                    id={`course-${course.id}`}
                                                    checked={isCompleted}
                                                    onCheckedChange={() => toggleCourse(course.id)}
                                                    aria-label={`수강 완료: ${course.name}`}
                                                    disabled={isSaving}
                                                />
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded font-bold">
                                                            {course.category || '전공'} · {course.term || '-'}
                                                        </span>
                                                        <span className="text-xs text-gray-400">{course.creditText}</span>
                                                    </div>
                                                    <h3 className={`font-bold text-lg text-[#333d4b] ${isCompleted ? 'line-through text-gray-400' : ''}`}>
                                                        {course.name}
                                                    </h3>
                                                    <p className="text-xs text-gray-400">
                                                        {course.requiredName ? `필수명: ${course.requiredName}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`text-xs font-bold whitespace-nowrap ${isCompleted ? 'text-emerald-600' : 'text-gray-300'}`}>
                                                {isCompleted ? '수강 완료' : '미완료'}
                                            </span>
                                        </label>
                                    );
                                })
                            )}
                        </div>

                        <p className="text-xs text-gray-500">
                            과목 체크 상태는 사용자 계정 기반으로 저장되어 기기 간 동기화됩니다.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
