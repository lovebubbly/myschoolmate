import { expect, test } from '@playwright/test';
import { applySemanticRerank, evaluateSearchConfidence, rankNoticeCandidates } from '@/lib/noticeSearch';

function makeCandidate(overrides: Partial<{
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
  baseScore: number;
}> = {}) {
  return {
    id: overrides.id ?? 1,
    title: overrides.title ?? '기본 공지',
    url: overrides.url ?? `https://example.com/${overrides.id ?? 1}`,
    date: overrides.date ?? '2026.02.10',
    category: overrides.category ?? 'Scholarship',
    summary: overrides.summary ?? null,
    content: overrides.content ?? null,
    minGrade: overrides.minGrade ?? null,
    maxIncome: overrides.maxIncome ?? null,
    minGpa: overrides.minGpa ?? null,
    scholarshipType: overrides.scholarshipType ?? null,
    deadline: overrides.deadline ?? null,
    baseScore: overrides.baseScore ?? 0,
  };
}

test.describe('notice retrieval ranking', () => {
  test('should prioritize scholarship notice matching grade/income/gpa constraints', () => {
    const candidates = [
      makeCandidate({
        id: 1,
        title: '2026학년도 1학기 성적우수 장학 선발',
        summary: '3학년 이상, 7분위 이하, GPA 3.2 이상 신청 가능',
        content: '장학 신청서와 성적증명서를 제출합니다.',
        minGrade: 3,
        maxIncome: 7,
        minGpa: 3.2,
        baseScore: 0.2,
      }),
      makeCandidate({
        id: 2,
        title: '저소득층 생활지원 장학 안내',
        summary: '3학년 이상, 3분위 이하 대상',
        content: '기초생활수급자 우선 선발',
        minGrade: 3,
        maxIncome: 3,
        minGpa: 2.5,
        baseScore: 0.7,
      }),
      makeCandidate({
        id: 3,
        title: '하계 인턴 모집 공지',
        category: 'Employment',
        summary: '인턴 지원자 모집',
        baseScore: 0.5,
      }),
    ];

    const ranked = rankNoticeCandidates(candidates, {
      question: '나 3학년 7분위 3.6인데 이번 주 신청할 만한 장학 뭐야?',
      topK: 3,
    });

    expect(ranked[0]?.id).toBe(1);
    expect(ranked.find((item) => item.id === 2)?.score).toBeLessThan(ranked[0].score);
  });

  test('should reward deadline and requirement intent for internship query', () => {
    const candidates = [
      makeCandidate({
        id: 10,
        title: 'ICT 기업 하계 인턴 모집',
        category: 'Employment',
        summary: '인턴 지원 가능',
        content: '모집 기간 2/10~2/20, 제출 서류: 이력서, 자기소개서',
        deadline: '2026.02.20',
        baseScore: 0.1,
      }),
      makeCandidate({
        id: 11,
        title: '취업 특강 안내',
        category: 'Employment',
        summary: '취업 준비 특강',
        content: '강의 참여 안내',
        baseScore: 0.3,
      }),
    ];

    const ranked = rankNoticeCandidates(candidates, {
      question: '인턴 모집 마감이 언제고, 준비물 뭐야?',
      topK: 2,
    });

    expect(ranked[0]?.id).toBe(10);
    expect(ranked[0]?.matchedKeywords.length).toBeGreaterThan(0);
  });

  test('should flag low confidence when top result has weak lexical match', () => {
    const ranked = rankNoticeCandidates(
      [
        makeCandidate({
          id: 21,
          title: '학생회 일반 공지',
          category: 'General',
          baseScore: 0.01,
        }),
      ],
      { question: '완전히 다른 키워드', topK: 1 },
    );

    const confidence = evaluateSearchConfidence(ranked, 3);
    expect(confidence.low).toBeTruthy();
    expect(confidence.reason).toBe('weak_match');
  });

  test('should reorder lexical candidates with semantic rerank score', () => {
    const rankedLexical = [
      {
        ...makeCandidate({
          id: 101,
          title: '학사 일정 일반 공지',
        }),
        score: 9.2,
        fieldScore: 0.6,
        recencyScore: 0.4,
        matchCount: 2,
        matchedKeywords: ['일반', '공지'],
      },
      {
        ...makeCandidate({
          id: 102,
          title: 'OCU 장학생 선발 공지',
          summary: '장학 신청 자격과 제출 서류 안내',
        }),
        score: 7.1,
        fieldScore: 0.2,
        recencyScore: 0.3,
        matchCount: 1,
        matchedKeywords: ['공지'],
      },
    ];

    const reranked = applySemanticRerank(
      rankedLexical,
      new Map<number, number>([
        [101, 0.1],
        [102, 1],
      ]),
      2,
    );

    expect(reranked[0]?.id).toBe(102);
    expect((reranked[0]?.hybridScore || 0)).toBeGreaterThan(reranked[1]?.hybridScore || 0);
  });

  test('should keep confidence when semantic signal is strong even with sparse keyword overlap', () => {
    const reranked = applySemanticRerank(
      [
        {
          ...makeCandidate({
            id: 201,
            title: '재정지원 프로그램 안내',
            baseScore: 0.01,
          }),
          score: 1.2,
          fieldScore: 0,
          recencyScore: 0,
          matchCount: 0,
          matchedKeywords: [],
        },
      ],
      new Map<number, number>([[201, 0.92]]),
      1,
    );

    const confidence = evaluateSearchConfidence(reranked, 2);
    expect(confidence.low).toBeFalsy();
    expect(confidence.reason).toBe('ok');
  });
});
