export const ALLOWED_TAGS = [
    '학사',
    '장학',
    '채용',
    '인턴십',
    '공모전',
    '연구',
    '공고',
    '행사',
    '멘토링',
    '동아리',
    '취업',
    '기초생활',
    '차상위',
    '기초수급',
    '대회',
    '세미나',
    '프로젝트',
] as const;

type Category = 'Academic/Scholarship' | 'General' | 'Employment' | 'News' | string;

type TagInput = {
    title: string;
    body?: string;
    category?: Category;
};

const TAG_KEYWORDS: Record<(typeof ALLOWED_TAGS)[number], string[]> = {
    학사: ['학사', '수강', '시험', '교과', '성적', '전공', '교과목', '졸업'],
    장학: ['장학', '장학금', '학자금', '학비', '기초생활', '차상위', '기초수급', '지원'],
    채용: ['채용', '채용공고', '채용공고', '채용설명회', '회사', '취업', '산업'],
    인턴십: ['인턴', '인턴십', '현장실습', '산학협력', '실습'],
    공모전: ['공모전', '공모', '대회', 'contest', '아이디어'],
    연구: ['연구', 'R&D', '학회', '논문', '세미나', '세미나'],
    공고: ['공지', '모집', '접수', '신청', '공고', '지원'],
    행사: ['행사', '특강', '초청', '이벤트', '세션', '강연'],
    멘토링: ['멘토링', '멘토', '멘티', '상담', '면담', '캠프'],
    동아리: ['동아리', '동호회', '학생회'],
    취업: ['취업', '채용', '면접', '자소서', '입사'],
    기초생활: ['기초생활', '차상위', '기초수급'],
    차상위: ['차상위'],
    기초수급: ['기초수급'],
    대회: ['대회', '경진', '해커톤', '공모전', '경시대회'],
    세미나: ['세미나', '특강', '강연', '워크숍', '설명회', '토크'],
    프로젝트: ['프로젝트', '과제', '캡스톤', '실습', '설계'],
};

function normalizeTag(tag: string): string {
    return String(tag || '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/[^가-힣a-zA-Z0-9]/g, '');
}

export function normalizeTags(tags: unknown[]): string[] {
    const normalized = (tags || [])
        .map((tag) => normalizeTag(String(tag)))
        .filter((tag) => tag.length > 0);

    const allowed = new Set(ALLOWED_TAGS.map((tag) => normalizeTag(tag)));
    const output = new Map<string, string>();

    normalized.forEach((normalizedTag) => {
        const matched = allowed.has(normalizedTag) ? normalizedTag : null;
        if (!matched) return;

        const original = ALLOWED_TAGS.find((tag) => normalizeTag(tag) === matched);
        if (original) output.set(matched, original);
    });

    return Array.from(output.values());
}

export function extractTagsByRegex(input: TagInput): string[] {
    const title = String(input?.title || '').toLowerCase();
    const body = String(input?.body || '').toLowerCase();
    const category = String(input?.category || '').toLowerCase();
    const text = `${title} ${body} ${category}`;

    const matched: string[] = [];

    if (category === 'academic/scholarship') {
        matched.push('학사');
    }
    if (category === 'general') {
        matched.push('공고');
    }
    if (category === 'employment') {
        matched.push('채용');
    }
    if (category === 'news') {
        matched.push('행사');
    }

    for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
        const isMatch = keywords.some((keyword) => text.includes(keyword.toLowerCase()));
        if (isMatch) {
            matched.push(tag);
        }
    }

    return normalizeTags(matched);
}
