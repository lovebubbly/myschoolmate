import { NextResponse } from 'next/server';
import { getGroundedNoticeAnswer } from '@/lib/gemini';
import { searchNotices } from '@/lib/noticeSearch';
import { applySessionCookieHeader } from '@/lib/sessionUser';
import { resolveUserProfile } from '@/lib/userProfileResolver';

export const dynamic = 'force-dynamic';

const MAX_QUESTION_LENGTH = 400;
const MIN_QUESTION_LENGTH = 2;

type Citation = {
  id: number;
  title: string;
  url: string;
  date: string;
  category: string;
};

function normalizeQuestion(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildKeywordSuggestionText(keywords: string[]): string {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return '장학, 인턴, 마감, 신청 자격';
  }
  return keywords.join(', ');
}

function buildLowConfidenceAnswer(keywords: string[]): string {
  const keywordText = buildKeywordSuggestionText(keywords);
  return `해당 공지를 찾지 못했어. 이런 키워드로 다시 물어봐줘: ${keywordText}`;
}

function appendCitationMarkdown(answer: string, citations: Citation[]): string {
  if (!citations.length) return answer;
  const citationLines = citations.map((citation) => `- [${citation.title}](${citation.url})`);
  return `${answer}\n\n### 참고한 공지\n${citationLines.join('\n')}`;
}

export async function POST(request: Request) {
  try {
    const session = await resolveUserProfile(request);

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const question = normalizeQuestion((body as { question?: unknown } | null)?.question);

    if (question.length < MIN_QUESTION_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: '질문은 2자 이상 입력해 주세요.',
        },
        { status: 400 },
      );
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          error: `질문은 ${MAX_QUESTION_LENGTH}자 이하로 입력해 주세요.`,
        },
        { status: 400 },
      );
    }

    const retrieval = await searchNotices(question, {
      topK: 8,
      profile: {
        grade: session.profile.grade,
        income: session.profile.income,
        gpa: session.profile.gpa,
      },
    });

    if (retrieval.results.length === 0 || retrieval.confidence.low) {
      const response = NextResponse.json({
        success: true,
        grounded: false,
        answer: buildLowConfidenceAnswer(retrieval.retryKeywords),
        citations: [],
        confidence: retrieval.confidence,
        suggestedKeywords: retrieval.retryKeywords,
      });
      applySessionCookieHeader(response, session.setCookie);
      return response;
    }

    const candidateNotices = retrieval.results.slice(0, 8).map((notice) => ({
      id: notice.id,
      title: notice.title,
      url: notice.url,
      date: notice.date,
      category: notice.category,
      summary: notice.summary,
      content: notice.content,
      minGrade: notice.minGrade,
      maxIncome: notice.maxIncome,
      minGpa: notice.minGpa,
      scholarshipType: notice.scholarshipType,
      deadline: notice.deadline,
    }));

    const grounded = await getGroundedNoticeAnswer({
      question,
      notices: candidateNotices,
      profile: {
        grade: session.profile.grade,
        income: session.profile.income,
        gpa: session.profile.gpa,
        trackId: session.profile.trackId,
      },
      keywordHints: retrieval.retryKeywords,
    });

    const byId = new Map(candidateNotices.map((notice) => [notice.id, notice] as const));
    const citations: Citation[] = grounded.citationIds
      .map((id) => byId.get(id))
      .filter((notice): notice is NonNullable<typeof notice> => Boolean(notice))
      .map((notice) => ({
        id: notice.id,
        title: notice.title,
        url: notice.url,
        date: notice.date || '',
        category: notice.category || '',
      }));

    if (grounded.answer === '해당 공지를 찾지 못했어.' || citations.length === 0) {
      const response = NextResponse.json({
        success: true,
        grounded: false,
        answer: buildLowConfidenceAnswer(grounded.keywordHints.length > 0 ? grounded.keywordHints : retrieval.retryKeywords),
        citations: [],
        confidence: retrieval.confidence,
        suggestedKeywords: grounded.keywordHints.length > 0 ? grounded.keywordHints : retrieval.retryKeywords,
      });
      applySessionCookieHeader(response, session.setCookie);
      return response;
    }

    const answer = appendCitationMarkdown(grounded.answer, citations);
    const response = NextResponse.json({
      success: true,
      grounded: true,
      answer,
      citations,
      confidence: retrieval.confidence,
      suggestedKeywords: grounded.keywordHints,
    });
    applySessionCookieHeader(response, session.setCookie);
    return response;
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '공지 Q&A 처리 중 오류가 발생했습니다.',
      },
      { status: 500 },
    );
  }
}
