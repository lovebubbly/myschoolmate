import { NextResponse } from 'next/server';
import curriculum from '@/lib/curriculum.json';

type RawCourse = {
    code?: string;
    name?: string;
    type?: string;
    credit?: string | number;
};

type TrackInfo = {
    name?: string;
    required?: string[];
};

type NormalizedCourse = {
    id: string;
    code: string;
    name: string;
    category: string;
    credit: string;
    term: string;
    year: string;
};

function normalizeName(text: string) {
    return text
        .toLowerCase()
        .replace(/[·•ㆍ]/g, '')
        .replace(/[()]/g, '')
        .replace(/\s+/g, '');
}

function termOrder(term: string) {
    const [gradeStr, semesterStr] = term.split('-');
    const grade = Number(gradeStr);
    const semester = Number(semesterStr);
    if (!Number.isFinite(grade) || !Number.isFinite(semester)) return Number.MAX_SAFE_INTEGER;
    return grade * 10 + semester;
}

export async function GET() {
    try {
        const data = curriculum as Record<string, unknown>;
        const tracksData = (data.tracks as Record<string, TrackInfo>) || {};

        // Prefer the latest numeric year key (e.g. "2025")
        const latestYearKey = Object.keys(data)
            .filter((key) => /^\d{4}$/.test(key))
            .sort((a, b) => Number(b) - Number(a))[0];

        const latestYearData = latestYearKey ? (data[latestYearKey] as Record<string, RawCourse[]>) : {};

        const allCourses: NormalizedCourse[] = Object.entries(latestYearData || {})
            .flatMap(([term, courses]) => {
                if (!Array.isArray(courses)) return [];
                return courses
                    .filter((course) => Boolean(course?.code) && Boolean(course?.name))
                    .map((course) => ({
                        id: String(course.code),
                        code: String(course.code),
                        name: String(course.name),
                        category: String(course.type || '전공'),
                        credit:
                            typeof course.credit === 'number'
                                ? `${course.credit}학점`
                                : String(course.credit || '-'),
                        term,
                        year: latestYearKey || 'Unknown',
                    }));
            })
            .sort((a, b) => termOrder(a.term) - termOrder(b.term));

        const tracks = Object.entries(tracksData).map(([id, track], index) => {
            const required = Array.isArray(track?.required) ? track.required : [];

            const mapped = required.map((requiredName) => {
                const requiredNorm = normalizeName(requiredName);
                const matched = allCourses.find((course) => {
                    const courseNorm = normalizeName(course.name);
                    return (
                        courseNorm === requiredNorm ||
                        courseNorm.includes(requiredNorm) ||
                        requiredNorm.includes(courseNorm)
                    );
                });
                return { requiredName, matched };
            });

            const courses = mapped
                .filter((entry) => Boolean(entry.matched))
                .map((entry) => ({
                    ...entry.matched!,
                    requiredName: entry.requiredName,
                }));

            const dedupedCourses = Array.from(
                new Map(courses.map((course) => [course.code, course])).values()
            );

            const missingRequired = mapped
                .filter((entry) => !entry.matched)
                .map((entry) => entry.requiredName);

            return {
                id: index + 1,
                key: id,
                name: track?.name || id,
                required,
                courses: dedupedCourses,
                missingRequired,
                sourceYear: latestYearKey || null,
            };
        });

        return NextResponse.json({ success: true, tracks });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
