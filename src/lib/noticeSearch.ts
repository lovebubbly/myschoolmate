import { parseNoticeDate } from '@/lib/noticePersonalization';
import { prisma } from '@/lib/prisma';

const SEARCH_TABLE_NAME = 'notice_search';
const DEFAULT_TOP_K = 8;
const MAX_TOP_K = 10;
const MIN_KEYWORD_LENGTH = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STOP_WORDS = new Set([
  '공지',
  '공지사항',
  '질문',
  '알려줘',
  '알려',
  '뭐야',
  '뭐',
  '추천',
  '주세요',
  '이번',
  '이번주',
  '이번달',
  '최근',
  '있어',
  '있나요',
  '찾아줘',
  '찾아',
  '어떤',
  '가능',
  '관련',
  '정리',
  '핵심',
  '요약',
  '해주세요',
  '해줘',
  '나',
  '내',
  '저',
]);

export type NoticeSearchProfile = {
  grade?: number | null;
  income?: number | null;
  gpa?: number | null;
};

export type NoticeSearchDocument = {
  id: number;
  title: string;
  url: string;
  date: string;
  category: string;
  summary: string | null;
  content: string | null;
  minGrade: number | null;
  maxIncome: number | null;
  minGpa: number | null;
  scholarshipType: string | null;
  deadline: string | null;
};

type NoticeSearchRow = NoticeSearchDocument & {
  rank: number;
};

export type NoticeSearchResult = NoticeSearchDocument & {
  score: number;
  baseScore: number;
  fieldScore: number;
  recencyScore: number;
  matchCount: number;
  matchedKeywords: string[];
};

export type NoticeSearchConfidence = {
  low: boolean;
  reason: 'ok' | 'no_results' | 'weak_match' | 'few_keywords';
  keywordCoverage: number;
  topScore: number;
  margin: number;
};

export type NoticeSearchResponse = {
  results: NoticeSearchResult[];
  keywords: string[];
  confidence: NoticeSearchConfidence;
  retryKeywords: string[];
};

type CandidateInput = NoticeSearchDocument & {
  baseScore: number;
};

let ensureSearchIndexPromise: Promise<void> | null = null;

function clampTopK(topK?: number): number {
  const parsed = Number(topK);
  if (!Number.isFinite(parsed)) return DEFAULT_TOP_K;
  const normalized = Math.trunc(parsed);
  if (normalized <= 0) return DEFAULT_TOP_K;
  if (normalized > MAX_TOP_K) return MAX_TOP_K;
  return normalized;
}

function normalizeSpace(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function normalizeQuestion(question: string): string {
  return normalizeSpace(question).toLowerCase();
}

function escapeLike(value: string): string {
  return value.replace(/[%_]/g, '').slice(0, 120);
}

function sanitizeFtsTerm(value: string): string {
  return normalizeSpace(value.replace(/["*()]/g, ''));
}

function tokenizeQuestion(question: string): string[] {
  const normalized = normalizeQuestion(question);
  if (!normalized) return [];

  const tokens = normalized.match(/[a-z0-9]+|[가-힣]+/g) || [];
  const deduped = new Set<string>();

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    if (STOP_WORDS.has(trimmed)) continue;
    if (trimmed.length < MIN_KEYWORD_LENGTH && !/\d/.test(trimmed)) continue;
    deduped.add(trimmed);
    if (deduped.size >= 12) break;
  }

  return Array.from(deduped);
}

function extractQuestionProfile(question: string): NoticeSearchProfile {
  const normalized = normalizeQuestion(question);
  const gradeMatch = normalized.match(/([1-4])\s*학년/);
  const incomeMatch = normalized.match(/(10|[0-9])\s*(?:구간|분위)/);
  const gpaMatch = normalized.match(/([0-4]\.[0-9]{1,2})/);

  return {
    grade: gradeMatch ? Number(gradeMatch[1]) : null,
    income: incomeMatch ? Number(incomeMatch[1]) : null,
    gpa: gpaMatch ? Number(gpaMatch[1]) : null,
  };
}

function getRecencyScore(dateValue: string): number {
  const parsed = parseNoticeDate(dateValue);
  if (!parsed) return 0;

  const ageDays = Math.floor((Date.now() - parsed.getTime()) / MS_PER_DAY);
  if (ageDays <= 7) return 1.1;
  if (ageDays <= 30) return 0.8;
  if (ageDays <= 90) return 0.4;
  return 0;
}

function safeText(value: unknown): string {
  return String(value || '').toLowerCase();
}

function resolveEffectiveProfile(
  profileFromQuestion: NoticeSearchProfile,
  fallbackProfile?: NoticeSearchProfile | null,
): Required<NoticeSearchProfile> {
  const fallbackGrade = normalizeNumber(fallbackProfile?.grade);
  const fallbackIncome = normalizeNumber(fallbackProfile?.income);
  const fallbackGpa = normalizeNumber(fallbackProfile?.gpa);

  return {
    grade: normalizeNumber(profileFromQuestion.grade) ?? fallbackGrade,
    income: normalizeNumber(profileFromQuestion.income) ?? fallbackIncome,
    gpa: normalizeNumber(profileFromQuestion.gpa) ?? fallbackGpa,
  };
}

function buildFtsMatchQuery(keywords: string[]): string | null {
  const terms = keywords
    .map(sanitizeFtsTerm)
    .filter((term) => term.length > 0)
    .slice(0, 8);

  if (terms.length === 0) return null;
  return terms.map((term) => `"${term}"*`).join(' OR ');
}

function buildRetryKeywords(question: string, keywords: string[]): string[] {
  const normalized = normalizeQuestion(question);
  const dynamic = keywords.filter((keyword) => keyword.length >= 2).slice(0, 2);
  const staticCandidates = [
    normalized.includes('장학') ? '장학금' : '장학',
    normalized.includes('인턴') ? '인턴' : '채용',
    '마감',
    '신청 자격',
  ];

  return Array.from(new Set([...dynamic, ...staticCandidates])).slice(0, 4);
}

export function rankNoticeCandidates(
  candidates: CandidateInput[],
  input: {
    question: string;
    profile?: NoticeSearchProfile | null;
    topK?: number;
  },
): NoticeSearchResult[] {
  const question = normalizeQuestion(input.question);
  const keywords = tokenizeQuestion(question);
  const profileFromQuestion = extractQuestionProfile(question);
  const effectiveProfile = resolveEffectiveProfile(profileFromQuestion, input.profile);

  const wantsDeadline = /(마감|언제|기한|일정|신청기간|기간)/.test(question);
  const wantsRequirements = /(준비물|서류|자격|조건|요건|대상)/.test(question);
  const wantsScholarship = /(장학|국가장학|지원금|근로장학)/.test(question);
  const wantsInternship = /(인턴|취업|채용|모집|현장실습)/.test(question);

  const ranked = candidates.map<NoticeSearchResult>((candidate) => {
    const text = safeText(
      `${candidate.title} ${candidate.summary || ''} ${candidate.content || ''} ${candidate.category} ${candidate.deadline || ''}`,
    );

    const matchedKeywords = keywords.filter((keyword) => text.includes(keyword));
    const matchScore = matchedKeywords.length * 1.25;

    let fieldScore = 0;
    if (typeof effectiveProfile.grade === 'number' && Number.isFinite(effectiveProfile.grade)) {
      if (candidate.minGrade === null || effectiveProfile.grade >= candidate.minGrade) fieldScore += 1.4;
      else fieldScore -= 2.2;
    }

    if (typeof effectiveProfile.income === 'number' && Number.isFinite(effectiveProfile.income)) {
      if (candidate.maxIncome === null || effectiveProfile.income <= candidate.maxIncome) fieldScore += 1.3;
      else fieldScore -= 2.0;
    }

    if (typeof effectiveProfile.gpa === 'number' && Number.isFinite(effectiveProfile.gpa) && effectiveProfile.gpa > 0) {
      if (candidate.minGpa === null || effectiveProfile.gpa >= candidate.minGpa) fieldScore += 1.1;
      else fieldScore -= 1.8;
    }

    let intentScore = 0;
    if (wantsDeadline && candidate.deadline) intentScore += 0.8;
    if (wantsRequirements && /(서류|준비물|제출|증빙|신청방법)/.test(text)) intentScore += 0.7;
    if (wantsScholarship && /(장학|지원금|근로장학|국가장학)/.test(text)) intentScore += 0.9;
    if (wantsInternship && /(인턴|취업|채용|현장실습)/.test(text)) intentScore += 0.9;

    const recencyScore = getRecencyScore(candidate.date);
    const score = candidate.baseScore * 2.2 + matchScore + fieldScore + intentScore + recencyScore;

    return {
      ...candidate,
      score,
      fieldScore,
      recencyScore,
      matchCount: matchedKeywords.length,
      matchedKeywords,
    };
  });

  return ranked
    .sort((a, b) => b.score - a.score || b.matchCount - a.matchCount || b.id - a.id)
    .slice(0, clampTopK(input.topK));
}

export function evaluateSearchConfidence(
  results: NoticeSearchResult[],
  keywordCount: number,
): NoticeSearchConfidence {
  if (results.length === 0) {
    return {
      low: true,
      reason: 'no_results',
      keywordCoverage: 0,
      topScore: 0,
      margin: 0,
    };
  }

  const top = results[0];
  const second = results[1];
  const keywordCoverage = keywordCount > 0 ? top.matchCount / keywordCount : 0;
  const margin = second ? top.score - second.score : top.score;

  const hasWeakSignal = top.matchCount === 0 || top.score < 2.2 || (keywordCount > 0 && keywordCoverage < 0.25);
  const tooFewKeywords = keywordCount === 0;
  const low = hasWeakSignal || tooFewKeywords;

  return {
    low,
    reason: tooFewKeywords ? 'few_keywords' : (low ? 'weak_match' : 'ok'),
    keywordCoverage,
    topScore: top.score,
    margin,
  };
}

async function buildNoticeSearchIndex() {
  await prisma.$executeRawUnsafe(
    `CREATE VIRTUAL TABLE IF NOT EXISTS ${SEARCH_TABLE_NAME} USING fts5(title, summary, content, category, deadline, tokenize='unicode61 remove_diacritics 2')`,
  );

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS notice_search_ai
    AFTER INSERT ON "Notice"
    BEGIN
      INSERT INTO ${SEARCH_TABLE_NAME}(rowid, title, summary, content, category, deadline)
      VALUES (
        new.id,
        coalesce(new.title, ''),
        coalesce(new.summary, ''),
        coalesce(new.content, ''),
        coalesce(new.category, ''),
        coalesce(new.deadline, '')
      );
    END;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS notice_search_ad
    AFTER DELETE ON "Notice"
    BEGIN
      DELETE FROM ${SEARCH_TABLE_NAME} WHERE rowid = old.id;
    END;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER IF NOT EXISTS notice_search_au
    AFTER UPDATE ON "Notice"
    BEGIN
      DELETE FROM ${SEARCH_TABLE_NAME} WHERE rowid = old.id;
      INSERT INTO ${SEARCH_TABLE_NAME}(rowid, title, summary, content, category, deadline)
      VALUES (
        new.id,
        coalesce(new.title, ''),
        coalesce(new.summary, ''),
        coalesce(new.content, ''),
        coalesce(new.category, ''),
        coalesce(new.deadline, '')
      );
    END;
  `);

  const countRows = await prisma.$queryRawUnsafe<Array<{ noticeCount: number; indexCount: number }>>(`
    SELECT
      CAST((SELECT COUNT(*) FROM "Notice") AS INTEGER) AS noticeCount,
      CAST((SELECT COUNT(*) FROM ${SEARCH_TABLE_NAME}) AS INTEGER) AS indexCount
  `);
  const counts = countRows[0] || { noticeCount: 0, indexCount: 0 };

  if (counts.noticeCount !== counts.indexCount) {
    await prisma.$executeRawUnsafe(`DELETE FROM ${SEARCH_TABLE_NAME}`);
    await prisma.$executeRawUnsafe(`
      INSERT INTO ${SEARCH_TABLE_NAME}(rowid, title, summary, content, category, deadline)
      SELECT
        id,
        coalesce(title, ''),
        coalesce(summary, ''),
        coalesce(content, ''),
        coalesce(category, ''),
        coalesce(deadline, '')
      FROM "Notice"
    `);
  }
}

async function ensureNoticeSearchIndex() {
  if (!ensureSearchIndexPromise) {
    ensureSearchIndexPromise = buildNoticeSearchIndex().catch((error) => {
      ensureSearchIndexPromise = null;
      throw error;
    });
  }
  await ensureSearchIndexPromise;
}

async function queryCandidates(question: string, topK: number): Promise<CandidateInput[]> {
  const keywords = tokenizeQuestion(question);
  const ftsQuery = buildFtsMatchQuery(keywords);
  const take = Math.max(topK * 4, 12);

  if (ftsQuery) {
    try {
      const rows = await prisma.$queryRawUnsafe<NoticeSearchRow[]>(
        `
        SELECT
          n.id AS id,
          n.title AS title,
          n.url AS url,
          n.date AS date,
          n.category AS category,
          n.summary AS summary,
          n.content AS content,
          n.minGrade AS minGrade,
          n.maxIncome AS maxIncome,
          n.minGpa AS minGpa,
          n.scholarshipType AS scholarshipType,
          n.deadline AS deadline,
          bm25(${SEARCH_TABLE_NAME}, 8.0, 4.0, 1.2, 1.0, 1.2) AS rank
        FROM ${SEARCH_TABLE_NAME}
        JOIN "Notice" n ON n.id = ${SEARCH_TABLE_NAME}.rowid
        WHERE ${SEARCH_TABLE_NAME} MATCH ?
        ORDER BY rank ASC
        LIMIT ?
      `,
        ftsQuery,
        take,
      );

      if (rows.length > 0) {
        return rows.map((row) => ({
          ...row,
          baseScore: Number.isFinite(Number(row.rank)) ? -Number(row.rank) : 0,
        }));
      }
    } catch (error) {
      console.error('Notice FTS query failed:', error);
    }
  }

  const likeTerm = `%${escapeLike(question)}%`;
  const fallbackRows = await prisma.$queryRawUnsafe<NoticeSearchRow[]>(
    `
    SELECT
      id,
      title,
      url,
      date,
      category,
      summary,
      content,
      minGrade,
      maxIncome,
      minGpa,
      scholarshipType,
      deadline,
      0 AS rank
    FROM "Notice"
    WHERE title LIKE ? OR summary LIKE ? OR content LIKE ?
    ORDER BY id DESC
    LIMIT ?
  `,
    likeTerm,
    likeTerm,
    likeTerm,
    take,
  );

  return fallbackRows.map((row) => ({
    ...row,
    baseScore: 0,
  }));
}

export async function searchNotices(
  question: string,
  options?: {
    topK?: number;
    profile?: NoticeSearchProfile | null;
  },
): Promise<NoticeSearchResponse> {
  const normalizedQuestion = normalizeSpace(question);
  const topK = clampTopK(options?.topK);
  const keywords = tokenizeQuestion(normalizedQuestion);

  if (!normalizedQuestion) {
    return {
      results: [],
      keywords: [],
      confidence: {
        low: true,
        reason: 'few_keywords',
        keywordCoverage: 0,
        topScore: 0,
        margin: 0,
      },
      retryKeywords: ['장학', '인턴', '마감', '신청 자격'],
    };
  }

  await ensureNoticeSearchIndex();
  const candidates = await queryCandidates(normalizedQuestion, topK);
  const ranked = rankNoticeCandidates(candidates, {
    question: normalizedQuestion,
    profile: options?.profile,
    topK,
  });
  const confidence = evaluateSearchConfidence(ranked, keywords.length);

  return {
    results: ranked,
    keywords,
    confidence,
    retryKeywords: buildRetryKeywords(normalizedQuestion, keywords),
  };
}
