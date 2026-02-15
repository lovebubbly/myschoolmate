
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractApplicationDeadlineFromText } from '@/lib/deadlineExtractor';
import { ALLOWED_TAGS, extractTagsByRegex, normalizeTags } from './tagging';

type BriefingProfileInput = {
    grade?: number | null;
    income?: number | null;
    gpa?: number | null;
    trackId?: number | null;
    raw?: string;
};

type BriefingNoticeInput = {
    title: string;
    summary?: string | null;
    url?: string | null;
    date?: string | null;
    category?: string | null;
    minGrade?: number | null;
    maxIncome?: number | null;
    minGpa?: number | null;
    scholarshipType?: string | null;
    deadline?: string | null;
    tags?: Array<string | null>;
};

type BriefingOptions = {
    maxItems?: number;
    recentDays?: number;
};

type BriefingProfile = {
    grade: number;
    income: number;
    gpa: number;
    trackId: number | null;
    raw: string;
};

const BRIEFING_MAX_ITEMS = 14;
const BRIEFING_RECENT_DAYS = 60;
const BRIEFING_MAX_ITEMS_MIN = 3;
const BRIEFING_MAX_ITEMS_MAX = 80;
const BRIEFING_RECENT_DAYS_MIN = 7;
const BRIEFING_RECENT_DAYS_MAX = 365;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Regex Helpers
function extractByRegex(title: string, body: string) {
    const text = `${title} ${body}`;

    // Income: "8구간", "8분위"
    let maxIncome: number | null = null;
    const incomeMatch = text.match(/([0-9]+)\s*(구간|분위)/);
    if (incomeMatch) {
        maxIncome = parseInt(incomeMatch[1]);
    } else if (text.includes('기초생활') || text.includes('기초수급') || text.includes('차상위')) {
        maxIncome = 0;
    }

    // Grade: "3학년", "3~4학년" 
    let minGrade: number | null = null;
    const gradeMatch = text.match(/([1-4])\s*학년/);
    if (gradeMatch) {
        minGrade = parseInt(gradeMatch[1]);
    } else if (text.includes('신입생')) {
        minGrade = 1;
    }

    const applicationDeadline = extractApplicationDeadlineFromText(text);

    // GPA: Handle 2.0~4.5 range, and various formats
    const gpaMatch = text.match(/(?:성적|평점|GPA).*?([2-4]\.[0-9][0-9]?)/i) ||
        text.match(/([2-4]\.[0-9][0-9]?)\s*(?:이상|\/|만점)/);
    const minGpa = gpaMatch ? parseFloat(gpaMatch[1]) : null;

    return { maxIncome, minGrade, applicationDeadline, minGpa };
}

async function inferTagsWithAI(title: string, body: string): Promise<string[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return [];

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
You are tagging a Korean university notice.
Pick 1-4 tags ONLY from this list: ${ALLOWED_TAGS.join(', ')}.
Use only the provided Title and Body.
Return JSON: { "tags": ["..."] }

Title: ${title}
Body: ${body.slice(0, 1500)}
`;

    try {
        const result = await model.generateContent(prompt);
        const data = JSON.parse(result.response.text());
        const tags = Array.isArray(data?.tags) ? data.tags : [];
        return normalizeTags(tags.map(String));
    } catch (e) {
        console.error('Tag inference error:', e);
        return [];
    }
}

function parseNumberOrFallback(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBriefingProfile(profile: string | BriefingProfileInput): BriefingProfile {
    if (typeof profile === 'string') {
        const gradeMatch = profile.match(/(\d+)\s*학년/);
        const incomeMatch = profile.match(/(\d+)\s*구간/);
        const gpaMatch = profile.match(/GPA:\s*([0-9]+(?:\.[0-9]+)?)/i);

        return {
            grade: parseNumberOrFallback(gradeMatch?.[1], 1),
            income: parseNumberOrFallback(incomeMatch?.[1], 10),
            gpa: parseNumberOrFallback(gpaMatch?.[1], 0),
            trackId: null,
            raw: profile,
        };
    }

    return {
        grade: parseNumberOrFallback(profile.grade, 1),
        income: parseNumberOrFallback(profile.income, 10),
        gpa: parseNumberOrFallback(profile.gpa, 0),
        trackId: profile.trackId ?? null,
        raw: profile.raw || `학년: ${parseNumberOrFallback(profile.grade, 1)}학년, 소득분위: ${parseNumberOrFallback(profile.income, 10)}구간, GPA: ${parseNumberOrFallback(profile.gpa, 0)}, 트랙: ${profile.trackId || '미선택'}`,
    };
}

function toTimestamp(value?: string | null): number | null {
    if (!value) return null;

    const match = value.match(/([12]\d{3})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
    if (!match) return null;

    const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function toSafeInt(value: unknown, fallback: number, min: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const rounded = Math.trunc(parsed);
    if (Number.isNaN(rounded)) return fallback;
    if (rounded < min) return min;
    if (rounded > max) return max;
    return rounded;
}

function normalizeText(value: string | null | undefined): string {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getNoticeTags(notice: BriefingNoticeInput): string[] {
    return Array.isArray(notice.tags)
        ? notice.tags.map((tag) => normalizeText(tag)).filter(Boolean)
        : [];
}

function isHighIncomeNeedBased(notice: BriefingNoticeInput, profile: BriefingProfile): boolean {
    if (profile.income < 9) return false;

    const scholarshipType = normalizeText(notice.scholarshipType);
    const needBasedScholarshipTypes = new Set([
        'livingsupport',
        'livingsupporting',
        'tuition',
        'tuitionaid',
        'scholarship',
        'needbased',
        'need-based',
        '국가근로',
        '국가장학',
    ]);

    if (needBasedScholarshipTypes.has(scholarshipType)) return true;

    if (typeof notice.maxIncome === 'number' && notice.maxIncome <= 8) return true;

    const tags = getNoticeTags(notice);

    const text = [notice.title, notice.summary, notice.category, notice.scholarshipType, notice.deadline]
        .map((value) => normalizeText(value))
        .join(' ');

    const needKeywords = ['국가장학', '국가근로', '저소득', '주거안정', '기초생활', '기초수급', '차상위', '도담이', '근로장학'];
    const hasNeedTag = tags.includes('장학') || tags.includes('기초생활') || tags.includes('차상위') || tags.includes('기초수급');
    const hasNeedKeyword = needKeywords.some((keyword) => text.includes(keyword));

    return hasNeedTag || hasNeedKeyword;
}

function isCareerNotice(notice: BriefingNoticeInput): boolean {
    const tags = getNoticeTags(notice);
    if (tags.includes('취업') || tags.includes('인턴') || tags.includes('채용') || tags.includes('프로젝트') || tags.includes('연구')) {
        return true;
    }

    const text = normalizeText([notice.title, notice.summary, notice.category, notice.scholarshipType].join(' '));
    const careerKeywords = ['인턴', '현장실습', '실습', '채용', '취업', '산학', '기업', '현장'];

    if (normalizeText(notice.scholarshipType) === 'job') return true;
    return careerKeywords.some((keyword) => text.includes(keyword));
}

function getRecencyScore(ts: number | null, now: number): number {
    if (ts === null) return -5;

    const ageInDays = Math.floor((now - ts) / MS_PER_DAY);

    if (ageInDays <= 30) return 45;
    if (ageInDays <= 60) return 30;
    if (ageInDays <= 90) return 15;
    return 0;
}

function isProfileMatch(notice: BriefingNoticeInput, profile: BriefingProfile): boolean {
    if (typeof notice.minGrade === 'number' && profile.grade < notice.minGrade) return false;
    if (typeof notice.minGpa === 'number' && profile.gpa > 0 && notice.minGpa > profile.gpa) return false;
    return true;
}

function scoreNotice(notice: BriefingNoticeInput & { ts: number | null }, profile: BriefingProfile): number {
    let score = 0;

    if (isCareerNotice(notice)) score += 30;
    if (isHighIncomeNeedBased(notice, profile)) score -= 120;

    const scholarshipType = normalizeText(notice.scholarshipType);
    if (scholarshipType === 'job') score += 20;
    if (scholarshipType === 'program') score += 10;
    if (scholarshipType === 'livingsupport') score -= 30;

    return score;
}

export async function getAIBriefing(
    notices: BriefingNoticeInput[],
    userProfile: string | BriefingProfileInput,
    options?: BriefingOptions,
) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY environment variable');

    const genAI = new GoogleGenerativeAI(apiKey);
    // gemini-2.5-flash-lite: stable, cost-effective, 1M context
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const profile = parseBriefingProfile(userProfile);
    const maxItems = toSafeInt(options?.maxItems, BRIEFING_MAX_ITEMS, BRIEFING_MAX_ITEMS_MIN, BRIEFING_MAX_ITEMS_MAX);
    const recentDays = toSafeInt(options?.recentDays, BRIEFING_RECENT_DAYS, BRIEFING_RECENT_DAYS_MIN, BRIEFING_RECENT_DAYS_MAX);

    const hour = parseInt(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Seoul' }));
    let timeContext = "Daytime";
    if (hour >= 5 && hour < 12) timeContext = "Morning";
    else if (hour >= 18 && hour < 22) timeContext = "Evening";
    else if (hour >= 22 || hour < 5) timeContext = "Late Night";

    const now = Date.now();
    const recentCutoff = now - recentDays * MS_PER_DAY;

    const rankedCandidates = notices
        .map((notice) => ({
            ...notice,
            ts: toTimestamp(notice.date),
        }))
        .filter((notice) => isProfileMatch(notice, profile))
        .map((notice) => ({
            ...notice,
            score: scoreNotice(notice, profile) + getRecencyScore(notice.ts, now),
        }))
        .filter((notice) => {
            if (profile.income >= 9 && isHighIncomeNeedBased(notice, profile) && notice.score < 0 && !isCareerNotice(notice)) {
                return false;
            }
            return true;
        })
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (b.ts || 0) - (a.ts || 0);
        });

    const highIncomeSafeCandidates = profile.income >= 9
        ? rankedCandidates.filter((notice) => !(isHighIncomeNeedBased(notice, profile) && !isCareerNotice(notice)))
        : rankedCandidates;

    const recentCandidates = (highIncomeSafeCandidates.length > 0 ? highIncomeSafeCandidates : rankedCandidates)
        .filter((notice) => notice.ts === null || notice.ts >= recentCutoff);
    const selectedCandidates = (recentCandidates.length > 0 ? recentCandidates : rankedCandidates)
        .slice(0, maxItems);

    const noticeData = selectedCandidates.map((n) => ({
        title: n.title,
        summary: n.summary?.slice(0, 120) || '',
        url: n.url || '',
        date: n.date || '',
        deadline: n.deadline || '',
        minGrade: n.minGrade ?? null,
        maxIncome: n.maxIncome ?? null,
        minGpa: n.minGpa ?? null,
        scholarshipType: n.scholarshipType || '',
        tags: getNoticeTags(n),
    }));

    if (noticeData.length === 0) {
        return '현재 추천 가능한 공지사항이 없습니다. 잠시 뒤 다시 확인해 주세요.';
    }

    const prompt = `
당신은 정보통신공학부 학생을 위한 학사 도우미입니다.

사용자 프로필: ${profile.raw}

우선순위:
- 최근 ${recentDays}일 이내 공지를 우선 반영
- 최근성 가중치: 30일 이내 +45, 60일 이내 +30, 90일 이내 +15
- 소득분위가 높으면(9~10) 소득요건 낮은 장학/근로/도담이류는 가급적 배제
- 인턴/취업/현장실습/프로젝트는 우선 추천
- 마감일은 유효한 값이 있으면 최신 공지를 가중치 반영

최근 공지사항 (JSON):
${JSON.stringify(noticeData, null, 2)}

---
**Instructions for AI Assistant:**

1.  **Goal**: Provide a personalized, concise briefing of relevant notices for the user.
2.  **Language**: Korean.
3.  **Current Context**: ${timeContext} (Hour: ${hour}).
4.  **Tone**: 
    -   **Opening**: Creative, witty, and casual greeting. **Avoid** cliché "Good morning/afternoon". Use something fresh like "Studying hard?", "Time for a break?", "Burning the midnight oil?", or "Ready to start the day?".
    -   **Body**: Warm, encouraging, concise. Like a helpful senior.
5.  **User Profile**:
    -   ${profile.raw}
    -   **Income Bracket**: 0 (High Need) ~ 10 (High Income).
        -   **Income 0~8**: High financial need. Target for need-based scholarships.
        -   **Income 9~10**: High income. **NOT** eligible for need-based aid. Do NOT suggest need-based scholarships.
    -   **GPA**: 4.5 scale.

6.  **STRICT Grounding & Truthfulness**:
    -   ONLY use the provided notice data. Do NOT invent notices or mix details between different notices.
    -   Ensure the mapping between Title, Summary, and URL is 100% accurate.
    -   If you mention a specific notice, the details must match the JSON data provided above.

Generate a briefing that:
1.  **[Important] Select Top 3 Notices**: Analyze applicability.
    -   If user is Income 9-10, prioritize Career/Internship/Events over Scholarships.
2.  Friendly, "Nudge" tone.
4.  **Format Rules (STRICT)**:
    -   **Link Style**: You MUST link the title directly. 
        -   ✅ Correct: **1. 📢 [ [Source] Title ](https://...)**
    -   **Brackets**: You CAN use square brackets ONLY for starting source labels like [CBNU] or [Department]. 
    -   **Additional Info**: If you add any extra information at the bottom, format it clearly using bullet points and avoid redundant bolding.

5.  **Personalized Explanation**:
    -   "Since your GPA is 3.5..."
    -   "As a 4th year student..."

6.  **Start** with your creative greeting.

Format Example:
(Creative Greeting)

Information for 2nd year student (Income 9)!

**1. 📢 [ [CBNU] (LIG Nex1) Internship Recruitment ](https://inform.chungbuk.ac.kr/...)**
Great chance for your Embedded Track career!

**2. 🏆 [ [Scholarship] Capstone Design Fair ](https://inform.chungbuk.ac.kr/...)**
Show off your skills!

Return ONLY the formatted markdown.
  `;

    try {
        const result = await model.generateContent(prompt);
        let text = result.response.text();
        // Post-processing: Fix broken links (e.g. "[Title] (URL)" -> "[Title](URL)")
        text = text.replace(/\] \(/g, '](');
        return text;
    } catch (e) {
        console.error('Gemini Error:', e);
        return '현재 AI 브리핑을 생성할 수 없습니다.';
    }
}

export async function analyzeNotice(title: string, body: string, category?: string | null): Promise<{
    summary: string;
    minGrade: number | null;
    maxIncome: number | null;
    scholarshipType: string;
    applicationDeadline: string | null;
    minGpa?: number | null;
    tags: string[];
}> {
    // 1. Regex Extraction (Cost-free, high precision for format)
    const regexData = extractByRegex(title, body);
    const regexTags = extractTagsByRegex({ title, body, category: category ?? undefined });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY environment variable');

    const genAI = new GoogleGenerativeAI(apiKey);
    // gemini-2.5-flash-lite for structured extraction
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', generationConfig: { responseMimeType: "application/json" } });

    const prompt = `
    Analyze this notice and extract information. 
    STRICT Grounding: Use ONLY the provided Title and Body. Do NOT use outside knowledge.

    Title: ${title}
    Body: ${body.slice(0, 5000)}

    Task:
    1. Summarize in Korean (1 sentence). The summary MUST be about this specific notice ONLY.
    2. Identify scholarship type (Tuition, LivingSupport, Program, Job, Other).
    3. Extract minGrade (1-4) and maxIncome (0-10) if mentioned.
    4. Extract deadline (YYYY.MM.DD).
    5. Extract minGpa (e.g. 3.0) if mentioned.

    Return JSON: { "summary", "scholarshipType", "minGrade", "maxIncome", "applicationDeadline", "minGpa" }
    `;

    try {
        const result = await model.generateContent(prompt);
        const aiData = JSON.parse(result.response.text());
        const inferredTags = regexTags.length > 0 ? regexTags : await inferTagsWithAI(title, body);

        return {
            summary: aiData.summary || "요약 없음",
            scholarshipType: aiData.scholarshipType || "Other",
            minGrade: (() => {
                const val = regexData.minGrade ?? aiData.minGrade;
                if (!val) return null;
                const num = parseInt(String(val));
                return isNaN(num) ? null : num;
            })(),
            maxIncome: (() => {
                const val = regexData.maxIncome ?? aiData.maxIncome;
                // Treat 0 as valid (0 bracket/basic living)
                if (val === undefined || val === null) return null;
                const num = parseInt(String(val));
                return isNaN(num) ? null : num;
            })(),
            applicationDeadline: regexData.applicationDeadline ?? aiData.applicationDeadline,
            minGpa: (() => {
                const val = regexData.minGpa ?? aiData.minGpa;
                if (!val) return null;
                const num = parseFloat(String(val));
                if (isNaN(num) || num > 10) return null; // Filter out "87" etc.
                return num;
            })(),
            tags: normalizeTags(inferredTags)
        };

    } catch (e) {
        console.error('Gemini Analysis Error:', e);
        // Fallback to purely regex data if AI fails
        return {
            summary: "AI 분석 실패 (키워드 추출)",
            minGrade: regexData.minGrade,
            maxIncome: regexData.maxIncome,
            scholarshipType: "Other",
            applicationDeadline: regexData.applicationDeadline,
            minGpa: regexData.minGpa,
            tags: regexTags
        };
    }
}

/**
 * Format raw notice content into clean, readable markdown.
 * Handles tables, lists, links, and proper spacing.
 */
export async function formatNoticeContent(rawContent: string): Promise<string> {
    if (!rawContent || rawContent.length < 50) return rawContent;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY environment variable');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `You are a content formatter. Convert the following raw Korean notice text into clean, well-structured Markdown.

**Rules:**
1. Preserve ALL original information - do not summarize or remove content
2. Format tables using proper Markdown table syntax (| header | header |)
   - Ensure every row has the same number of columns as the header
   - Ensure EVERY cell has a value (use "-" if empty)
   - Escape pipe characters (|) within cell content as \\|
   - IMPORTANT: If a cell contains multiple lines, flatten them into a single line or use <br> tags
   - **CRITICAL**: If a table has MORE than 6 columns, simplify it by:
     a) Keep only the most essential columns (e.g., 분야, 인원, 자격조건, 비고)
     b) Add a note: "※ 상세 내용은 첨부파일을 확인해주세요."
3. Use bullet lists (- or *) for list items
4. Use **bold** for important dates, deadlines, and key terms
5. Add proper line breaks between sections
6. Format links as [text](url) if URLs are present
7. Clean up excessive whitespace but keep logical paragraph breaks
8. Keep the language in Korean - do not translate
9. If there's a schedule/timeline, format it as a table (max 5 columns)
10. Escape tildes (~) used for ranges to prevent strikethrough (e.g., 10시\\~17시)
11. Output ONLY the formatted markdown, no explanations

Raw content:
${rawContent.slice(0, 8000)}`;

    try {
        const result = await model.generateContent(prompt);
        const formatted = result.response.text();

        // Post-processing fix for common table issues
        if (formatted) {
            // Ensure no "dotted" lists break tables? 
            // Actually usually Gemini handles this well, but we can double check.
        }

        return formatted || rawContent;
    } catch (e) {
        console.error('Content formatting error:', e);
        return rawContent; // Return original if formatting fails
    }
}
