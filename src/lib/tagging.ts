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

const FALLBACK_TITLE_WEAK_MATCHES = 1;
const FALLBACK_BODY_WEAK_MATCHES = 1;

type KeywordWeight = {
    strong: string[];
    weak?: string[];
};

const TAG_KEYWORDS: Record<(typeof ALLOWED_TAGS)[number], KeywordWeight> = {
    학사: {
        strong: ['학사', '수강', '시험', '전공', '교과', '교과목', '성적'],
        weak: ['졸업', '수강신청'],
    },
    장학: {
        strong: ['장학', '장학금', '학자금', '기초생활', '차상위', '기초수급', '지원금'],
        weak: ['학비', '지원금'],
    },
    채용: {
        strong: ['채용', '채용공고', '면접', '자소서', '입사', '취업'],
        weak: ['산업', '회사'],
    },
    인턴십: {
        strong: ['인턴', '인턴십', '현장실습'],
        weak: ['산학협력', '실습'],
    },
    공모전: {
        strong: ['공모전', '공모', '대회', '해커톤'],
        weak: ['contest', '경진', '아이디어', '경시대회'],
    },
    연구: {
        strong: ['연구', '학회', '논문'],
        weak: ['r&d'],
    },
    공고: {
        strong: ['공지', '모집', '신청', '접수', '공고'],
        weak: ['지원'],
    },
    행사: {
        strong: ['행사', '특강', '강연', '설명회'],
        weak: ['초청', '이벤트', '세션', '토크'],
    },
    멘토링: {
        strong: ['멘토링', '멘토', '멘티', '코칭'],
        weak: ['상담', '캠프', '면담'],
    },
    동아리: {
        strong: ['동아리', '동호회'],
        weak: ['학생회'],
    },
    취업: {
        strong: ['취업', '채용', '인턴', '인턴십', '현장실습', '면접', '자소서', '입사'],
        weak: ['산업', '회사', '프로젝트'],
    },
    기초생활: {
        strong: ['기초생활'],
        weak: ['기초수급', '차상위'],
    },
    차상위: {
        strong: ['차상위'],
    },
    기초수급: {
        strong: ['기초수급'],
    },
    대회: {
        strong: ['대회', '경진', '해커톤', '공모전', '경시대회'],
        weak: ['contest', '아이디어'],
    },
    세미나: {
        strong: ['세미나', '특강', '강연'],
        weak: ['워크숍', '설명회', '토크'],
    },
    프로젝트: {
        strong: ['프로젝트', '캡스톤', '설계'],
        weak: ['과제', '실습'],
    },
};

function normalizeInputText(value: string) {
    return String(value || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeTag(tag: string): string {
    return String(tag || '')
        .trim()
        .replace(/\s+/g, '')
        .replace(/[^가-힣a-zA-Z0-9]/g, '');
}

function createSearchRegex(term: string) {
    const escaped = term
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .toLowerCase();

    if (escaped.length <= 2) {
        return new RegExp(`(^|[^가-힣a-z0-9])${escaped}(?=[^가-힣a-z0-9]|$)`, 'i');
    }

    return new RegExp(escaped, 'i');
}

function hasKeyword(text: string, term: string) {
    if (!text || !term) return false;
    const normalized = term.toLowerCase();
    if (normalized.length === 0) return false;
    return createSearchRegex(normalized).test(text);
}

export function normalizeTags(tags: unknown[]): string[] {
    const normalized = (tags || [])
        .map((tag) => normalizeTag(String(tag)))
        .filter((tag) => tag.length > 0);

    const allowed = new Set(ALLOWED_TAGS.map((tag) => normalizeTag(tag)));
    const output = new Map<string, string>();

    normalized.forEach((normalizedTag) => {
        if (!allowed.has(normalizedTag)) return;
        const original = ALLOWED_TAGS.find((tag) => normalizeTag(tag) === normalizedTag);
        if (original) output.set(normalizedTag, original);
    });

    return Array.from(output.values());
}

export function extractTagsByRegex(input: TagInput): string[] {
    const title = normalizeInputText(input?.title || '');
    const body = normalizeInputText(input?.body || '');
    const category = String(input?.category || '').toLowerCase();

    const matchedTags = new Set<string>();

    if (category === 'academic/scholarship') {
        matchedTags.add('학사');
    }
    if (category === 'general') {
        matchedTags.add('공고');
    }
    if (category === 'employment') {
        matchedTags.add('채용');
    }
    if (category === 'news') {
        matchedTags.add('행사');
    }

    for (const [tag, tokens] of Object.entries(TAG_KEYWORDS) as Array<[keyof typeof TAG_KEYWORDS, KeywordWeight]>) {
        let hasStrongMatch = false;
        let weakTitleMatches = 0;
        let weakBodyMatches = 0;

        for (const keyword of tokens.strong) {
            if (!hasStrongMatch && hasKeyword(title, keyword)) hasStrongMatch = true;
            if (!hasStrongMatch && hasKeyword(body, keyword)) hasStrongMatch = true;
        }

        if (!hasStrongMatch && tokens.weak) {
            for (const keyword of tokens.weak) {
                const hasInTitle = hasKeyword(title, keyword);
                const hasInBody = hasKeyword(body, keyword);

                if (!hasInTitle && !hasInBody) continue;
                if (hasInTitle) weakTitleMatches += 1;
                if (hasInBody) weakBodyMatches += 1;
            }
        }

        const shouldKeepByWeakMatch = weakTitleMatches >= FALLBACK_TITLE_WEAK_MATCHES || weakBodyMatches >= FALLBACK_BODY_WEAK_MATCHES;
        if (!hasStrongMatch && !shouldKeepByWeakMatch) continue;
        matchedTags.add(tag);
    }

    return normalizeTags(Array.from(matchedTags));
}
