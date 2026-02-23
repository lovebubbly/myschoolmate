export type RelevanceReason =
  | 'grade_match'
  | 'income_match'
  | 'gpa_match'
  | 'track_match'
  | 'deadline_soon'
  | 'career_priority';

export type NoticeActionState = 'todo' | 'in_progress' | 'done' | 'dismissed';

export type UrgencyLevel = 'none' | 'upcoming' | 'urgent' | 'today' | 'overdue';

export type RecommendationProfile = {
  grade: number;
  income: number;
  gpa: number;
  trackId: number | null;
};

export type EligibilityStatus = 'eligible' | 'ineligible' | 'unknown';

export type EligibilityReason = 'grade_below_min' | 'gpa_below_min' | 'income_above_max';

export type PersonalizedNoticeInput = {
  title: string;
  category: string;
  summary?: string | null;
  scholarshipType?: string | null;
  minGrade?: number | null;
  maxIncome?: number | null;
  minGpa?: number | null;
  deadline?: string | null;
  date?: string | null;
  tags?: Array<{ name?: string | null; slug?: string | null }>;
};

const VALID_ACTION_STATES = new Set<NoticeActionState>(['todo', 'in_progress', 'done', 'dismissed']);

function normalizeText(value: unknown): string {
  return String(value || '').toLowerCase().trim();
}

function toSafeInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function isCareerNotice(notice: PersonalizedNoticeInput): boolean {
  const text = [
    notice.title,
    notice.category,
    notice.summary,
    notice.scholarshipType,
    ...((notice.tags || []).map((tag) => `${tag?.name || ''} ${tag?.slug || ''}`)),
  ]
    .map((value) => normalizeText(value))
    .join(' ');

  const careerKeywords = ['취업', '인턴', '채용', '현장실습', '프로젝트', '기업', 'job', 'intern'];
  return careerKeywords.some((keyword) => text.includes(keyword));
}

function parseLooseDate(value?: string | null): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const match = raw.match(/([12]\d{3})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    const date = new Date(y, m - 1, d, 23, 59, 59, 999);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 8) {
    const y = Number(digits.slice(0, 4));
    const m = Number(digits.slice(4, 6));
    const d = Number(digits.slice(6, 8));
    const date = new Date(y, m - 1, d, 23, 59, 59, 999);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (digits.length === 4) {
    const now = new Date();
    const y = now.getFullYear();
    const m = Number(digits.slice(0, 2));
    const d = Number(digits.slice(2, 4));
    const date = new Date(y, m - 1, d, 23, 59, 59, 999);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }

  return null;
}

export function parseDeadlineDate(deadline?: string | null): Date | null {
  return parseLooseDate(deadline);
}

export function parseNoticeDate(value?: string | null): Date | null {
  return parseLooseDate(value);
}

export function computeDday(deadline: Date, now = new Date()): number {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - base.getTime()) / (1000 * 60 * 60 * 24));
}

export function getUrgencyLevel(dday: number | null): UrgencyLevel {
  if (dday === null) return 'none';
  if (dday < 0) return 'overdue';
  if (dday === 0) return 'today';
  if (dday <= 3) return 'urgent';
  if (dday <= 7) return 'upcoming';
  return 'none';
}

export function normalizeActionState(value: unknown): NoticeActionState | null {
  const normalized = normalizeText(value) as NoticeActionState;
  return VALID_ACTION_STATES.has(normalized) ? normalized : null;
}

export function normalizeRecommendationProfile(input: Partial<RecommendationProfile>): RecommendationProfile {
  return {
    grade: Math.min(4, Math.max(1, toSafeInt(input.grade, 1))),
    income: Math.min(10, Math.max(0, toSafeInt(input.income, 10))),
    gpa: Math.min(4.5, Math.max(0, Number.isFinite(Number(input.gpa)) ? Number(input.gpa) : 0)),
    trackId: input.trackId === null || input.trackId === undefined ? null : Math.max(1, toSafeInt(input.trackId, 1)),
  };
}

export function computeEligibility(
  notice: Pick<PersonalizedNoticeInput, 'minGrade' | 'maxIncome' | 'minGpa'>,
  profile: RecommendationProfile,
): {
  status: EligibilityStatus;
  reasons: EligibilityReason[];
} {
  const reasons: EligibilityReason[] = [];
  let hasCriteria = false;

  if (typeof notice.minGrade === 'number' && Number.isFinite(notice.minGrade)) {
    hasCriteria = true;
    if (profile.grade < notice.minGrade) {
      reasons.push('grade_below_min');
    }
  }

  if (typeof notice.minGpa === 'number' && Number.isFinite(notice.minGpa)) {
    hasCriteria = true;
    if (profile.gpa < notice.minGpa) {
      reasons.push('gpa_below_min');
    }
  }

  if (typeof notice.maxIncome === 'number' && Number.isFinite(notice.maxIncome)) {
    hasCriteria = true;
    if (profile.income > notice.maxIncome) {
      reasons.push('income_above_max');
    }
  }

  if (!hasCriteria) {
    return { status: 'unknown', reasons: [] };
  }

  return {
    status: reasons.length > 0 ? 'ineligible' : 'eligible',
    reasons,
  };
}

export function computeRelevance(
  notice: PersonalizedNoticeInput,
  profile: RecommendationProfile,
): {
  score: number;
  reasons: RelevanceReason[];
  isUrgent: boolean;
  urgency: UrgencyLevel;
  dday: number | null;
  deadlineDate: Date | null;
} {
  let score = 0;
  const reasons: RelevanceReason[] = [];

  if (typeof notice.minGrade === 'number') {
    if (profile.grade >= notice.minGrade) {
      score += 20;
      reasons.push('grade_match');
    } else {
      score -= 30;
    }
  }

  if (typeof notice.maxIncome === 'number') {
    if (profile.income <= notice.maxIncome) {
      score += 14;
      reasons.push('income_match');
    } else {
      score -= 18;
    }
  }

  if (typeof notice.minGpa === 'number') {
    if (profile.gpa >= notice.minGpa) {
      score += 12;
      reasons.push('gpa_match');
    } else {
      score -= 14;
    }
  }

  if (profile.trackId !== null) {
    score += 4;
    reasons.push('track_match');
  }

  if (isCareerNotice(notice)) {
    score += 18;
    reasons.push('career_priority');
  }

  const deadlineDate = parseDeadlineDate(notice.deadline);
  const dday = deadlineDate ? computeDday(deadlineDate) : null;
  const urgency = getUrgencyLevel(dday);
  const isUrgent = urgency === 'today' || urgency === 'urgent' || urgency === 'upcoming';

  if (isUrgent) {
    score += dday === 0 ? 30 : dday !== null && dday <= 3 ? 24 : 14;
    reasons.push('deadline_soon');
  }

  const noticeDate = parseNoticeDate(notice.date);
  if (noticeDate) {
    const ageDays = Math.floor((Date.now() - noticeDate.getTime()) / (1000 * 60 * 60 * 24));
    if (ageDays <= 7) score += 10;
    else if (ageDays <= 30) score += 5;
  }

  return {
    score,
    reasons: Array.from(new Set(reasons)),
    isUrgent,
    urgency,
    dday,
    deadlineDate,
  };
}
