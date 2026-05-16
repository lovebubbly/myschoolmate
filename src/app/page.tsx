'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowRight, Calendar, Sparkles, SlidersHorizontal, Map as MapIcon, Settings as SettingsIcon, LayoutGrid, List, BellRing, CheckCheck, Clock3, BookmarkPlus, Trash2, Star, Share2, Download, Target, Trophy, BriefcaseBusiness, BarChart3, Flame } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { LoadingOverlay, ButtonLoader } from '@/components/LoadingOverlay';
import { CafeteriaWidget } from '@/components/CafeteriaWidget';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { GripVertical, Layout, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import { NoticeChatbot, type NoticeChatAskResult, type NoticeChatCitation } from '@/components/NoticeChatbot';
import { CommandPalette } from '@/components/CommandPalette';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import Link from "next/link";

interface Notice {
  id: number;
  title: string;
  url: string;
  date: string;
  category: string;
  summary?: string;
  minGrade?: number | null;
  maxIncome?: number | null;
  scholarshipType?: string;
  deadline?: string | null;
  minGpa?: number | null;
  content?: string | null;
  tags?: Array<{ id?: number; slug: string; name: string }>;
  relevanceScore?: number;
  relevanceReasons?: RelevanceReason[];
  actionState?: NoticeActionState | null;
  isFavorite?: boolean;
  isUrgent?: boolean;
  urgency?: 'none' | 'upcoming' | 'urgent' | 'today' | 'overdue';
  dday?: number | null;
  favoriteCount?: number;
  isEasyToMiss?: boolean;
  isPinned: boolean;
  matchesWatchlist?: boolean;
}

type RelevanceReason = "grade_match" | "income_match" | "gpa_match" | "track_match" | "deadline_soon" | "career_priority";
type NoticeActionState = "todo" | "in_progress" | "done" | "dismissed";
type BriefingTone = 'friendly' | 'concise' | 'formal' | 'motivational';
type BriefingLength = 'short' | 'medium' | 'long';
type BriefingCategory = 'Academic' | 'Scholarship' | 'Employment' | 'General' | 'News';

type NoticePreset = {
  id: number;
  name: string;
  categories: string[];
  tags: string[];
  profileOverrides: {
    grade?: number;
    income?: number;
    gpa?: number;
    trackId?: number | null;
  } | null;
};

interface InboxItem {
  id: string;
  noticeId: number;
  type: 'NEW_NOTICE' | 'DEADLINE_SOON';
  title: string;
  subtitle: string;
  priority: number;
}

type NavInboxItem = Omit<InboxItem, 'type'> & {
  type: InboxItem['type'] | 'EASY_TO_MISS';
};

interface FilterProfile {
  grade: number;
  income: number;
  gpa: number;
}

interface LoadedProfile {
  grade: number;
  income: number;
  gpa: number;
}

interface NoticeAutoCrawlerStatus {
  started: boolean;
  running: boolean;
  intervalMinutes: number;
  maxAgeMinutes: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureReason: string | null;
  lastProcessedCount: number;
  retryCount: number;
  lastTrigger: string | null;
}

type DashboardState = {
  readNoticeIds: number[];
  widgetOrder: string[];
  enabledWidgets: Record<string, boolean>;
  briefing?: {
    tone?: BriefingTone;
    length?: BriefingLength;
    focusCategories?: BriefingCategory[];
  };
};

const READ_NOTICE_IDS_KEY = 'dashboard-read-notice-ids-v1';
const NOTICE_BASELINE_KEY = 'dashboard-notice-baseline-v1';
const WIDGET_ORDER_KEY = 'dashboard-widget-order';
const WIDGET_ENABLED_KEY = 'dashboard-enabled-widgets';
const NOTICE_SELECTED_TAGS_KEY = 'dashboard-selected-tags-v1';
const NOTICE_TAG_MODE_KEY = 'dashboard-tag-mode-v1';
const NOTICE_SORT_MODE_KEY = 'dashboard-sort-mode-v1';
const NOTICE_DEADLINE_WINDOW_KEY = 'dashboard-deadline-window-v1';
const NOTICE_FAVORITE_ONLY_KEY = 'dashboard-favorite-only-v1';
const NOTICE_WATCHLIST_ONLY_KEY = 'dashboard-watchlist-only-v1';
const NOTICE_BROWSER_NOTIFICATIONS_KEY = 'dashboard-browser-notifications-v1';
const NOTICE_NOTIFIED_NEW_IDS_KEY = 'dashboard-notified-new-ids-v1';
const NOTICE_NOTIFIED_URGENT_IDS_KEY = 'dashboard-notified-urgent-ids-v1';
const NOTICE_ACTIVE_PRESET_KEY = 'dashboard-active-preset-v1';
const NOTICE_RECOMMEND_PREVIEW_KEY = 'dashboard-recommend-preview-v1';
const BRIEFING_TONE_KEY = 'dashboard-briefing-tone-v1';
const BRIEFING_LENGTH_KEY = 'dashboard-briefing-length-v1';
const BRIEFING_FOCUS_KEY = 'dashboard-briefing-focus-v1';
const NOTICE_FETCH_LIMIT = 200;
const FALLBACK_WIDGET_ORDER = ['cafeteria', 'notices'];
const FALLBACK_WIDGET_ENABLED: Record<string, boolean> = { cafeteria: true, notices: true };
const VALID_WIDGET_IDS = ['cafeteria', 'notices'];
const BRIEFING_FOCUS_CATEGORIES: BriefingCategory[] = ['Academic', 'Scholarship', 'Employment', 'General', 'News'];
const BRIEFING_FOCUS_LABEL: Record<BriefingCategory, string> = {
  Academic: '학사',
  Scholarship: '장학',
  Employment: '취업',
  General: '일반',
  News: '뉴스',
};

function normalizeReadNoticeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  );
}

function normalizeWidgetOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return [...FALLBACK_WIDGET_ORDER];

  const normalized = value
    .map((item) => String(item).trim())
    .filter((item) => VALID_WIDGET_IDS.includes(item));

  const unique = Array.from(new Set(normalized));
  const missing = FALLBACK_WIDGET_ORDER.filter((item) => !unique.includes(item));
  return [...unique, ...missing];
}

function normalizeEnabledWidgets(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...FALLBACK_WIDGET_ENABLED };

  return {
    cafeteria: typeof (value as { cafeteria?: unknown }).cafeteria === 'boolean' ? Boolean((value as { cafeteria?: unknown }).cafeteria) : FALLBACK_WIDGET_ENABLED.cafeteria,
    notices: typeof (value as { notices?: unknown }).notices === 'boolean' ? Boolean((value as { notices?: unknown }).notices) : FALLBACK_WIDGET_ENABLED.notices,
  };
}

function normalizeTagList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0)
    )
  );
}

function normalizeTagMode(value: unknown): 'any' | 'all' {
  return String(value).toLowerCase() === 'all' ? 'all' : 'any';
}

function normalizeNoticeActionState(value: unknown): NoticeActionState | null {
  if (value === 'todo' || value === 'in_progress' || value === 'done' || value === 'dismissed') {
    return value;
  }
  return null;
}

function normalizeRelevanceReasons(value: unknown): RelevanceReason[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<RelevanceReason>([
    'grade_match',
    'income_match',
    'gpa_match',
    'track_match',
    'deadline_soon',
    'career_priority',
  ]);
  return Array.from(
    new Set(
      value
        .map((item) => String(item))
        .filter((item): item is RelevanceReason => allowed.has(item as RelevanceReason)),
    ),
  );
}

function normalizeChatCitations(value: unknown): NoticeChatCitation[] {
  if (!Array.isArray(value)) return [];

  const deduped = new Map<number, NoticeChatCitation>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Record<string, unknown>;
    const id = Number(raw.id);
    const title = String(raw.title || '').trim();
    const url = String(raw.url || '').trim();
    if (!Number.isInteger(id) || id <= 0 || !title || !url) continue;

    deduped.set(id, {
      id,
      title,
      url,
      date: String(raw.date || ''),
      category: String(raw.category || ''),
    });
  }

  return Array.from(deduped.values());
}

function normalizeBriefingTone(value: unknown): BriefingTone | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'friendly' || normalized === 'concise' || normalized === 'formal' || normalized === 'motivational') {
    return normalized;
  }
  return null;
}

function normalizeBriefingLength(value: unknown): BriefingLength | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'short' || normalized === 'medium' || normalized === 'long') {
    return normalized;
  }
  return null;
}

function normalizeBriefingFocusCategories(value: unknown): BriefingCategory[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<BriefingCategory>(BRIEFING_FOCUS_CATEGORIES);
  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim())
        .filter((item): item is BriefingCategory => allowed.has(item as BriefingCategory)),
    ),
  );
}

type NoticeTag = { id?: number; slug: string; name: string };
type NoticeTagInput = NoticeTag | string | null;
const RELEVANCE_REASON_LABEL: Record<RelevanceReason, string> = {
  grade_match: '학년 매칭',
  income_match: '소득 매칭',
  gpa_match: '학점 매칭',
  track_match: '트랙 반영',
  deadline_soon: '마감 임박',
  career_priority: '취업/인턴 우선',
};
const ACTION_STATE_LABEL: Record<NoticeActionState, string> = {
  todo: '검토 예정',
  in_progress: '준비중',
  done: '완료',
  dismissed: '관심 없음',
};
const ACTION_STATE_OPTIONS: Array<{ value: NoticeActionState; label: string }> = [
  { value: 'todo', label: '검토 예정' },
  { value: 'in_progress', label: '준비중' },
  { value: 'done', label: '완료' },
  { value: 'dismissed', label: '관심 없음' },
];

function normalizeTagSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getNoticeTagLabel(tag: NoticeTag) {
  const name = (tag.name || '').trim();
  const slug = (tag.slug || '').trim();
  return name.length > 0 ? name : slug;
}

function normalizeNoticeTag(tag: NoticeTagInput): NoticeTag | null {
  if (!tag) return null;

  if (typeof tag === 'string') {
    const name = tag.trim();
    if (!name) return null;
    return {
      slug: normalizeTagSlug(name),
      name,
    };
  }

  if (typeof tag !== 'object') return null;

  const name = typeof tag.name === 'string' ? tag.name.trim() : '';
  const rawSlug = typeof tag.slug === 'string' ? tag.slug.trim() : '';
  const resolvedName = name || rawSlug;
  const slug = normalizeTagSlug(rawSlug || (resolvedName ? resolvedName : ''));
  if (!resolvedName || !slug) return null;

  return {
    id: typeof tag.id === 'number' && Number.isFinite(tag.id) ? tag.id : undefined,
    slug,
    name: resolvedName,
  };
}

function normalizeNoticeTags(tags: unknown): NoticeTag[] {
  if (!Array.isArray(tags)) return [];

  const deduped = new Map<string, NoticeTag>();
  for (const tag of tags) {
    const normalized = normalizeNoticeTag(tag as NoticeTagInput);
    if (!normalized) continue;
    if (deduped.has(normalized.slug)) continue;
    deduped.set(normalized.slug, normalized);
  }

  return Array.from(deduped.values());
}

function dedupeNoticesById(notices: Notice[]): Notice[] {
  const seen = new Set<number>();
  const deduped: Notice[] = [];

  for (const notice of notices) {
    if (!notice || seen.has(notice.id)) continue;
    seen.add(notice.id);
    deduped.push(notice);
  }

  return deduped;
}

function toCrawlerStatusText(status: NoticeAutoCrawlerStatus | null) {
  if (!status) return '공지 수집 상태: 확인 중';
  if (status.running) return '공지 수집 상태: 현재 수집 진행 중';

  if (status.lastFailureReason) {
    const countText = status.retryCount > 0 ? ` (재시도 ${status.retryCount}회)` : '';
    return `최신 데이터 갱신이 지연되고 있어요. 잠시 뒤 다시 시도해 주세요.${countText}`;
  }

  if (status.lastSuccessAt) {
    const latest = new Date(status.lastSuccessAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    return `최신 데이터 갱신 상태: 정상 (${latest})`;
  }

  return '최신 데이터 갱신 상태: 미수집';
}

function parseDeadline(deadline?: string | null): Date | null {
  if (!deadline) return null;

  const digitsOnly = deadline.replace(/\D/g, '');
  const now = new Date();
  let year = now.getFullYear();
  let month = 0;
  let day = 0;

  if (digitsOnly.length >= 8) {
    year = Number(digitsOnly.slice(0, 4));
    month = Number(digitsOnly.slice(4, 6));
    day = Number(digitsOnly.slice(6, 8));
  } else if (digitsOnly.length === 4) {
    month = Number(digitsOnly.slice(0, 2));
    day = Number(digitsOnly.slice(2, 4));
  } else {
    return null;
  }

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsed = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isScholarshipNotice(notice: Pick<Notice, 'title' | 'category' | 'scholarshipType'>) {
  const categoryText = String(notice.category || '').toLowerCase();
  const scholarshipType = String(notice.scholarshipType || '').toLowerCase();
  const hasScholarshipType = scholarshipType === 'tuition' || scholarshipType === 'livingsupport' || scholarshipType === 'scholarship';
  return (
    categoryText.includes('scholarship') ||
    hasScholarshipType ||
    notice.title.includes('장학') ||
    notice.title.includes('지원금') ||
    notice.title.includes('국가장학') ||
    notice.title.includes('학자금')
  );
}

function isEmploymentNotice(notice: Pick<Notice, 'title' | 'category'>) {
  const categoryText = String(notice.category || '').toLowerCase();
  const title = String(notice.title || '');
  return (
    categoryText.includes('employment') ||
    title.includes('인턴') ||
    title.includes('채용') ||
    title.includes('현장실습') ||
    title.includes('취업')
  );
}

function toCategoryLabel(category: string) {
  if (category === 'Academic') return '학사';
  if (category === 'Scholarship') return '장학';
  if (category === 'General') return '일반';
  if (category === 'Employment') return '취업';
  if (category === 'News') return '뉴스';
  return '전체';
}

function compactTitleForSuggestion(title: string, maxLength = 34) {
  const normalized = String(title || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '이 공지';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function getWidgetLabel(id: string) {
  if (id === 'cafeteria') return '오늘의 학식';
  if (id === 'notices') return '공지사항';
  return id;
}

function getDday(deadline: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getNoticeDday(notice: Pick<Notice, 'dday' | 'deadline'>) {
  if (typeof notice.dday === 'number' && Number.isFinite(notice.dday)) return notice.dday;
  const deadline = parseDeadline(notice.deadline);
  return deadline ? getDday(deadline) : null;
}

function getActionPriorityLabel(notice: Notice) {
  const dday = getNoticeDday(notice);
  if (typeof dday === 'number' && dday >= 0 && dday <= 3) return '마감 먼저';
  if (notice.isEasyToMiss) return '놓치기 쉬움';
  if (isScholarshipNotice(notice)) return '장학 확인';
  if (isEmploymentNotice(notice)) return '기회 확인';
  if ((notice.relevanceScore || 0) >= 40) return '추천 높음';
  return '확인 추천';
}

const ACTION_KEYWORD_PATTERN = /(신청|접수|모집|채용|선발|추천\s*요청|지원금|장학|인턴|현장실습|프로젝트랩|수강신청|공모|대회|특강|교육|설명회)/;
const PASSIVE_NEWS_PATTERN = /(교수\s*(임용|부임)|우수논문상|수상|달성|기탁|선정|취임|동정|보도|결과|소식)/;
const ACTION_PLAN_MAX_DEADLINE_DAYS = 14;
const ACTION_PLAN_MAX_PUBLISHED_AGE_DAYS = 21;

function parseNoticeDate(dateValue?: string | null): Date | null {
  if (!dateValue) return null;
  const digitsOnly = dateValue.replace(/\D/g, '');
  if (digitsOnly.length < 8) return null;
  const year = Number(digitsOnly.slice(0, 4));
  const month = Number(digitsOnly.slice(4, 6));
  const day = Number(digitsOnly.slice(6, 8));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getNoticePublishedAgeDays(notice: Pick<Notice, 'date'>) {
  const publishedAt = parseNoticeDate(notice.date);
  if (!publishedAt) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  publishedAt.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24));
}

function getActionText(notice: Notice) {
  const tagText = (notice.tags || []).map((tag) => getNoticeTagLabel(tag)).join(' ');
  return `${notice.title || ''} ${notice.summary || ''} ${tagText}`;
}

function isActionableNotice(notice: Notice) {
  const dday = getNoticeDday(notice);
  if (typeof dday === 'number') {
    if (dday < 0) return false;
    return dday <= ACTION_PLAN_MAX_DEADLINE_DAYS || notice.actionState === 'todo' || notice.actionState === 'in_progress';
  }

  if (notice.actionState === 'todo' || notice.actionState === 'in_progress') return true;

  const ageDays = getNoticePublishedAgeDays(notice);
  if (ageDays < 0 || ageDays > ACTION_PLAN_MAX_PUBLISHED_AGE_DAYS) return false;

  const actionText = getActionText(notice);
  const hasActionSignal = ACTION_KEYWORD_PATTERN.test(actionText);
  if (!hasActionSignal) return false;

  const isPassiveNews = PASSIVE_NEWS_PATTERN.test(actionText);
  return !isPassiveNews;
}

function clampStoredIds(ids: Iterable<number>, maxSize = 500) {
  const normalized = Array.from(new Set(Array.from(ids).filter((id) => Number.isInteger(id) && id > 0)));
  return normalized.slice(Math.max(0, normalized.length - maxSize));
}

function base64UrlToUint8Array(base64Url: string) {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (padded.length % 4)) % 4);
  const base64 = `${padded}${padding}`;
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderHighlightedText(text: string, query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return text;

  const pattern = new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'ig');
  const segments = text.split(pattern).filter((segment) => segment.length > 0);

  return (
    <>
      {segments.map((segment, index) => {
        const matched = segment.toLowerCase() === normalizedQuery.toLowerCase();
        return matched ? (
          <mark
            key={`highlight-${index}-${segment}`}
            className="rounded px-1 py-0.5 bg-amber-300/70 text-amber-900 dark:bg-amber-500/30 dark:text-amber-100"
          >
            {segment}
          </mark>
        ) : (
          <span key={`highlight-${index}-${segment}`}>{segment}</span>
        );
      })}
    </>
  );
}

function formatDdayLabel(
  dday: number | null | undefined,
  mode: 'badge' | 'subtitle' = 'badge',
): string {
  if (typeof dday !== 'number' || !Number.isFinite(dday)) {
    return '마감 미정';
  }
  if (dday === 0) {
    return mode === 'subtitle' ? '오늘 마감' : 'D-Day';
  }
  if (dday > 0) {
    return mode === 'subtitle' ? `마감 D-${dday}` : `D-${dday}`;
  }
  const daysPast = Math.abs(dday);
  return mode === 'subtitle' ? `마감 지남 (D+${daysPast})` : '마감 지남';
}

function NoticeCard({
  notice,
  filterProfile,
  searchQuery,
  onOpen,
  onToggleFavorite,
  favoriteSubmitting,
  index = 0,
}: {
  notice: Notice;
  filterProfile: FilterProfile;
  searchQuery: string;
  onOpen: (n: Notice) => void;
  onToggleFavorite: (noticeId: number, nextValue: boolean) => void;
  favoriteSubmitting: boolean;
  index?: number;
}) {
  // Helper for translating categories/types
  const translateType = (type: string) => {
    const map: Record<string, string> = {
      'Tuition': '등록금',
      'LivingSupport': '생활비',
      'Scholarship': '장학',
      'Job': '취업연계',
      'Program': '프로그램',
      'Event': '행사',
      'Other': '기타',
      'Academic': '학사',
      'Employment': '취업',
      'General': '일반',
      'News': '소식'
    };
    return map[type] || type;
  };

  return (
    <motion.div
      data-testid="notice-card"
      layout
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={{
        delay: index * 0.05,
        type: 'spring',
        stiffness: 320,
        damping: 26,
        layout: {
          type: 'spring',
          stiffness: 360,
          damping: 30
        }
      }}
      whileHover={{
        y: -8,
        scale: 1.025,
        transition: { type: 'spring', stiffness: 320, damping: 24 }
      }}
      whileFocus={{
        y: -8,
        scale: 1.025,
        transition: { type: 'spring', stiffness: 320, damping: 24 }
      }}
      whileTap={{
        scale: 0.985
      }}
      className="h-full"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(notice)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          onOpen(notice);
        }}
        aria-label={`공지 상세 열기: ${notice.title}`}
        className="w-full h-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded-[24px]"
      >
      <Card
        className="group relative overflow-hidden bg-card hover:bg-muted/30 border-border/60 hover:border-primary/30 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 rounded-[24px] cursor-pointer h-full min-h-[220px] will-change-transform"
      >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="p-5 flex flex-col gap-4 h-full">
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Category Badge - Minimal */}
                <span className="px-2.5 py-1 rounded-[10px] bg-muted/50 text-muted-foreground border border-border/50 text-[11px] font-semibold transition-colors group-hover:text-foreground group-hover:border-primary/10">
                  {(() => {
                    const cat = notice.category;
                    // Handle combined or specific categories
                    if (cat.includes('Academic')) return '학사';
                    if (cat.includes('Scholarship')) return '장학';
                    if (cat.includes('Employment')) return '취업';
                    if (cat.includes('Tuition')) return '등록금';
                    return translateType(cat);
                  })()}
                </span>

                {/* Special Tags - Outline Style */}
                {notice.scholarshipType && notice.scholarshipType !== 'Other' && (
                  <span className="px-2.5 py-1 rounded-[10px] bg-blue-500/[0.05] text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50 text-[11px] font-medium">
                    {translateType(notice.scholarshipType)}
                  </span>
                )}
                {filterProfile.grade > 0 && notice.minGrade && filterProfile.grade >= notice.minGrade && (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-[10px] bg-green-500/[0.05] text-green-600 dark:text-green-400 border border-green-200/50 dark:border-green-800/50 text-[11px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500/60 animate-pulse" />
                    학년 매칭
                  </span>
                )}
                {notice.matchesWatchlist && (
                  <span className="px-2.5 py-1 rounded-[10px] bg-purple-500/[0.06] text-purple-700 dark:text-purple-300 border border-purple-500/20 text-[11px] font-medium">
                    워치리스트
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground/60 font-medium shrink-0 tracking-tight">{notice.date}</span>
            </div>

            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-[17px] leading-snug text-foreground/90 group-hover:text-primary transition-colors tracking-tight">
                {renderHighlightedText(notice.title, searchQuery)}
              </h3>
              <button
                type="button"
                disabled={favoriteSubmitting}
                aria-label={notice.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onToggleFavorite(notice.id, !notice.isFavorite);
                }}
                className={`shrink-0 p-2 rounded-lg border transition-colors ${notice.isFavorite
                  ? 'text-amber-500 border-amber-300/50 bg-amber-500/10'
                  : 'text-muted-foreground border-border bg-background/70 hover:text-foreground'}`}
              >
                <Star className={`w-4 h-4 ${notice.isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>

            {(notice.relevanceScore !== undefined || (notice.relevanceReasons && notice.relevanceReasons.length > 0) || notice.actionState) && (
              <div className="flex flex-wrap items-center gap-2">
                {typeof notice.relevanceScore === 'number' && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                    추천점수 {notice.relevanceScore}
                  </span>
                )}
                {notice.actionState && (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {ACTION_STATE_LABEL[notice.actionState]}
                  </span>
                )}
                {(notice.relevanceReasons || []).slice(0, 2).map((reason) => (
                  <span
                    key={`${notice.id}-${reason}`}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                  >
                    {RELEVANCE_REASON_LABEL[reason]}
                  </span>
                ))}
              </div>
            )}

            {/* AI Summary Section - Cleaner Look + Gradient Restored */}
            {notice.summary && (
              <div className="text-sm font-medium text-foreground/90 leading-relaxed bg-muted/30 p-4 rounded-2xl border border-border/40 group-hover:border-primary/10 transition-colors">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-red-500 bg-clip-text text-transparent">
                    AI 요약
                  </span>
                </div>
                <span className="block line-clamp-2 md:line-clamp-3">
                  {renderHighlightedText(notice.summary, searchQuery)}
                </span>
              </div>
            )}

            {/* Bottom Tags - Unified Minimal Style */}
            <div className="mt-auto pt-3 flex flex-wrap gap-2">
              {(notice.tags || []).map((tag) => (
                <span
                  key={`${notice.id}-${tag.slug}`}
                  className="text-[11px] font-semibold text-muted-foreground/90 bg-muted/50 px-2.5 py-1 rounded-lg border border-border/50"
                >
                  #{getNoticeTagLabel(tag)}
                </span>
              ))}
              {notice.deadline && (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/[0.05] px-2.5 py-1 rounded-lg border border-rose-200/50 dark:border-rose-900/30">
                  <Calendar className="w-3 h-3 opacity-70" />
                  <span>{notice.dday !== null && notice.dday !== undefined ? formatDdayLabel(notice.dday) : `~${notice.deadline}`}</span>
                </span>
              )}
              {notice.minGrade && (
                <span className="text-[11px] font-medium text-muted-foreground/80 bg-secondary/50 px-2.5 py-1 rounded-lg border border-border/50">
                  최소 {notice.minGrade}학년
                </span>
              )}
              {notice.maxIncome !== null && (
                <span className="text-[11px] font-medium text-muted-foreground/80 bg-secondary/50 px-2.5 py-1 rounded-lg border border-border/50">
                  소득 {notice.maxIncome}구간↓
                </span>
              )}
              {notice.minGpa && (
                <span className="text-[11px] font-medium text-muted-foreground/80 bg-secondary/50 px-2.5 py-1 rounded-lg border border-border/50">
                  학점 {notice.minGpa}↑
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

function NoticeDialog({
  notice,
  isOpen,
  onClose,
  onActionChange,
  actionSubmitting,
  onToggleFavorite,
  favoriteSubmitting,
  onDownloadCalendar,
  onShareNotice,
}: {
  notice: Notice | null;
  isOpen: boolean;
  onClose: () => void;
  onActionChange: (noticeId: number, state: NoticeActionState) => void;
  actionSubmitting: boolean;
  onToggleFavorite: (noticeId: number, nextValue: boolean) => void;
  favoriteSubmitting: boolean;
  onDownloadCalendar: (notice: Notice) => void;
  onShareNotice: (notice: Notice) => void;
}) {
  const fallbackContentMessage = "본문 내용이 없습니다. 원문을 확인해주세요.";

  if (!notice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] sm:w-[95vw] md:w-[800px] lg:w-[900px] max-w-[96vw] sm:max-w-[95vw] md:max-w-[900px] h-[92dvh] sm:h-[90vh] rounded-[20px] sm:rounded-[32px] p-0 border-none bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md p-4 sm:p-6 border-b border-border/50 flex justify-between items-start shrink-0 min-w-0">
          <div className="space-y-1 pr-2 sm:pr-8 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase">
                {notice.category}
              </span>
              <span className="text-xs text-muted-foreground font-medium">{notice.date}</span>
            </div>
            <DialogTitle className="text-lg sm:text-xl font-extrabold leading-tight text-foreground break-words">
              {notice.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              공지 상세 내용, AI 요약, 액션 체크리스트를 확인합니다.
            </DialogDescription>
            {((notice.tags && notice.tags.length > 0) || typeof notice.relevanceScore === 'number' || (notice.relevanceReasons || []).length > 0) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {(notice.tags || []).map((tag) => (
                  <span
                    key={`${notice.id}-${tag.slug}-dialog`}
                    className="text-[11px] font-semibold text-muted-foreground/90 bg-muted/50 px-2.5 py-1 rounded-lg border border-border/50"
                  >
                    #{getNoticeTagLabel(tag)}
                  </span>
                ))}
                {typeof notice.relevanceScore === 'number' && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                    추천점수 {notice.relevanceScore}
                  </span>
                )}
                {(notice.relevanceReasons || []).map((reason) => (
                  <span
                    key={`${notice.id}-dialog-reason-${reason}`}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                  >
                    {RELEVANCE_REASON_LABEL[reason]}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={favoriteSubmitting}
              onClick={() => onToggleFavorite(notice.id, !notice.isFavorite)}
              className={`rounded-full ${notice.isFavorite ? 'text-amber-500 hover:text-amber-600' : ''}`}
              aria-label={notice.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            >
              <Star className={`w-5 h-5 ${notice.isFavorite ? 'fill-current' : ''}`} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full hover:bg-muted -mt-1 -mr-1"
              aria-label="공지 상세 닫기"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="px-4 sm:px-6 pt-2 pb-4 sm:pb-6 space-y-6 overflow-y-auto overflow-x-hidden notice-dialog-scroll flex-1 min-h-0 w-full max-w-full overscroll-y-contain">
          <div className="space-y-6 w-full max-w-full min-w-0 overflow-x-hidden">
            {notice.summary && (
              <div className="bg-primary/5 rounded-2xl p-4 sm:p-5 border border-primary/10">
                <h4 className="text-sm font-bold text-primary mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-red-500 bg-clip-text text-transparent">
                    AI 요약
                  </span>
                </h4>
                <p className="text-sm sm:text-[15px] leading-relaxed text-foreground/90 break-words [overflow-wrap:anywhere]">
                  {notice.summary}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {notice.deadline && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  {notice.dday !== null && notice.dday !== undefined ? formatDdayLabel(notice.dday, 'subtitle') : `~${notice.deadline}`}
                </span>
              )}
              {notice.isFavorite && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  즐겨찾기
                </span>
              )}
              {notice.minGrade && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted/50 text-muted-foreground border border-border/60">
                  최소 {notice.minGrade}학년
                </span>
              )}
              {notice.maxIncome !== null && notice.maxIncome !== undefined && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted/50 text-muted-foreground border border-border/60">
                  소득 {notice.maxIncome}구간↓
                </span>
              )}
              {notice.minGpa && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-muted/50 text-muted-foreground border border-border/60">
                  학점 {notice.minGpa}↑
                </span>
              )}
            </div>

            <div
              data-testid="notice-detail-content"
              className="text-foreground/80 leading-7 sm:leading-8 text-[14px] sm:text-[15px] prose dark:prose-invert max-w-none w-full min-w-0 overflow-x-hidden break-words [overflow-wrap:anywhere]"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  strong: (props) => <span className="font-bold text-primary" {...props} />,
                  p: (props) => <p className="mb-4 last:mb-0" {...props} />,
                  ul: (props) => <ul className="list-disc ml-5 space-y-2 my-4" {...props} />,
                  li: (props) => <li {...props} />,
                  table: (props) => (
                    <div className="w-full max-w-full min-w-0 overflow-x-auto my-6 rounded-2xl border border-border shadow-sm bg-card/50">
                      <table className="min-w-full divide-y divide-border text-[13px] border-collapse" {...props} />
                    </div>
                  ),
                  thead: (props) => <thead className="bg-muted/50 border-b border-border" {...props} />,
                  th: (props) => <th className="px-4 py-3 text-left font-bold text-foreground border-r border-border/50 last:border-r-0 whitespace-nowrap bg-muted/10 min-w-[120px]" {...props} />,
                  td: (props) => <td className="px-4 py-3 border-t border-border text-muted-foreground border-r border-border/50 last:border-r-0 min-w-[120px] whitespace-pre-wrap break-words leading-normal align-top text-xs md:text-[13px]" {...props} />,
                  a: (props) => {
                    const href = props.href as string | undefined;
                    return (
                      <a
                        className="text-primary font-bold hover:underline underline-offset-4 break-all"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={href ? `외부 링크: ${href}` : '새 탭에서 열기'}
                        {...props}
                      />
                    );
                  },
                  h1: (props) => <h1 className="text-2xl font-bold mb-4 mt-8 text-foreground" {...props} />,
                  h2: (props) => <h2 className="text-xl font-bold mb-3 mt-6 text-foreground border-b border-border pb-2" {...props} />,
                  h3: (props) => <h3 className="text-lg font-bold mb-2 mt-4 text-foreground" {...props} />,
                }}
              >
                {notice.content || fallbackContentMessage}
              </ReactMarkdown>
            </div>

            <div className="bg-muted/30 rounded-2xl p-4 border border-border/50 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">액션 체크리스트</p>
              <div className="flex flex-wrap gap-2">
                {ACTION_STATE_OPTIONS.map((option) => {
                  const active = notice.actionState === option.value;
                  return (
                    <button
                      key={`${notice.id}-action-${option.value}`}
                      type="button"
                      onClick={() => onActionChange(notice.id, option.value)}
                      disabled={actionSubmitting}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:text-foreground'}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-8 pb-4">
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-12 rounded-xl font-bold"
                onClick={() => onDownloadCalendar(notice)}
                disabled={!notice.deadline}
              >
                <Download className="w-4 h-4 mr-2" />
                캘린더 추가
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-12 rounded-xl font-bold"
                onClick={() => onShareNotice(notice)}
              >
                <Share2 className="w-4 h-4 mr-2" />
                공유하기
              </Button>
              <Button
                type="button"
                asChild
                variant="outline"
                className="h-11 sm:h-12 rounded-xl font-bold"
              >
                <a
                  href={notice.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`공지 원문 새 탭 열기: ${notice.title}`}
                >
                  원문 보러가기 <ArrowRight className="w-4 h-4 ml-2" />
                </a>
              </Button>
              <Button
                type="button"
                className="h-11 sm:h-12 rounded-xl font-bold bg-primary text-primary-foreground"
                onClick={onClose}
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
        <style jsx>{`
          .notice-dialog-scroll {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .notice-dialog-scroll::-webkit-scrollbar {
            width: 0;
            height: 0;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<string>('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingTone, setBriefingTone] = useState<BriefingTone | null>(null);
  const [briefingLength, setBriefingLength] = useState<BriefingLength | null>(null);
  const [briefingFocusCategories, setBriefingFocusCategories] = useState<BriefingCategory[]>([]);
  const [isBriefingTuningOpen, setIsBriefingTuningOpen] = useState(false);
  const [autoCrawlerStatus, setAutoCrawlerStatus] = useState<NoticeAutoCrawlerStatus | null>(null);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatAnswer, setChatAnswer] = useState('');
  const [chatCitations, setChatCitations] = useState<NoticeChatCitation[]>([]);
  const [chatSuggestedKeywords, setChatSuggestedKeywords] = useState<string[]>([]);

  // Layout & Search State
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'latest' | 'relevance' | 'deadline'>('latest');
  const [deadlineWithinDays, setDeadlineWithinDays] = useState<number | null>(null);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(false);
  const [webPushSupported, setWebPushSupported] = useState(false);
  const [webPushConfigured, setWebPushConfigured] = useState(false);
  const [webPushPublicKey, setWebPushPublicKey] = useState<string | null>(null);
  const [webPushSubscribed, setWebPushSubscribed] = useState(false);
  const [webPushBusy, setWebPushBusy] = useState(false);
  const [recommendationPreviewEnabled, setRecommendationPreviewEnabled] = useState(true);

  // Dialog State
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [filterProfile, setFilterProfile] = useState<FilterProfile>({ grade: 0, income: 11, gpa: 0 }); // Default income 11 (All)
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<'any' | 'all'>('any');
  const [loadedProfile, setLoadedProfile] = useState<LoadedProfile | null>(null);
  const [presets, setPresets] = useState<NoticePreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<number | null>(null);
  const [presetBusy, setPresetBusy] = useState(false);
  const [actionBusyNoticeId, setActionBusyNoticeId] = useState<number | null>(null);
  const [favoriteBusyNoticeId, setFavoriteBusyNoticeId] = useState<number | null>(null);

  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);

  // Pagination
  const ITEMS_PER_PAGE = 12;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Inbox State
  const [readNoticeIds, setReadNoticeIds] = useState<number[]>([]);

  // Widget Reordering State
  const [widgetOrder, setWidgetOrder] = useState<string[]>([...FALLBACK_WIDGET_ORDER]);
  const [enabledWidgets, setEnabledWidgets] = useState<Record<string, boolean>>({ ...FALLBACK_WIDGET_ENABLED });
  const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);
  const [clientStateHydrated, setClientStateHydrated] = useState(false);
  const allowDashboardSyncRef = useRef(false);
  const dashboardSyncTimerRef = useRef<number | null>(null);
  const serviceWorkerRegRef = useRef<ServiceWorkerRegistration | null>(null);
  const notifiedNewNoticeIdsRef = useRef<Set<number>>(new Set());
  const notifiedUrgentNoticeIdsRef = useRef<Set<number>>(new Set());
  const initialBriefingLoadedRef = useRef(false);
  const briefingTuningActiveCount =
    Number(Boolean(briefingTone)) +
    Number(Boolean(briefingLength)) +
    (briefingFocusCategories.length > 0 ? 1 : 0);

  const syncDashboardState = useCallback(async (nextState?: Partial<DashboardState>) => {
    if (!allowDashboardSyncRef.current) return;

    const requestedBriefing = nextState?.briefing ?? {
      tone: briefingTone ?? undefined,
      length: briefingLength ?? undefined,
      focusCategories: briefingFocusCategories,
    };
    const normalizedBriefingTone = normalizeBriefingTone(requestedBriefing?.tone);
    const normalizedBriefingLength = normalizeBriefingLength(requestedBriefing?.length);
    const normalizedBriefingFocus = normalizeBriefingFocusCategories(requestedBriefing?.focusCategories);
    const hasBriefingSettings = Boolean(normalizedBriefingTone || normalizedBriefingLength || normalizedBriefingFocus.length > 0);

    const payload: DashboardState = {
      readNoticeIds: normalizeReadNoticeIds(nextState?.readNoticeIds ?? readNoticeIds),
      widgetOrder: normalizeWidgetOrder(nextState?.widgetOrder ?? widgetOrder),
      enabledWidgets: normalizeEnabledWidgets(nextState?.enabledWidgets ?? enabledWidgets),
      briefing: hasBriefingSettings
        ? {
          tone: normalizedBriefingTone || undefined,
          length: normalizedBriefingLength || undefined,
          focusCategories: normalizedBriefingFocus.length > 0 ? normalizedBriefingFocus : undefined,
        }
        : undefined,
    };

    try {
      await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboardState: payload,
        }),
      });
    } catch (error) {
      console.error('Failed to sync dashboard state:', error);
    }
  }, [briefingFocusCategories, briefingLength, briefingTone, enabledWidgets, readNoticeIds, widgetOrder]);

  const queueDashboardSync = useCallback((nextState?: Partial<DashboardState>) => {
    if (!allowDashboardSyncRef.current) return;

    if (dashboardSyncTimerRef.current !== null) {
      window.clearTimeout(dashboardSyncTimerRef.current);
    }

    dashboardSyncTimerRef.current = window.setTimeout(() => {
      void syncDashboardState(nextState);
    }, 500);
  }, [syncDashboardState]);

  useEffect(() => {
    return () => {
      if (dashboardSyncTimerRef.current !== null) {
        window.clearTimeout(dashboardSyncTimerRef.current);
      }
    };
  }, []);

  const fetchBriefing = useCallback(async (override?: {
    tone?: BriefingTone | null;
    length?: BriefingLength | null;
    focusCategories?: BriefingCategory[];
  }) => {
    setBriefingLoading(true);
    try {
      const tone = override?.tone !== undefined ? override.tone : briefingTone;
      const length = override?.length !== undefined ? override.length : briefingLength;
      const focusCategories = override?.focusCategories !== undefined
        ? normalizeBriefingFocusCategories(override.focusCategories)
        : briefingFocusCategories;

      const searchParams = new URLSearchParams();
      if (tone) searchParams.set('tone', tone);
      if (length) searchParams.set('length', length);
      for (const category of focusCategories) {
        searchParams.append('focusCategories', category);
      }
      const requestUrl = searchParams.size > 0
        ? `/api/briefing?${searchParams.toString()}`
        : '/api/briefing';

      const res = await fetch(requestUrl, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setBriefing(data.briefing);
      }
    } catch (e) {
      console.error(e);
    }
    setBriefingLoading(false);
  }, [briefingFocusCategories, briefingLength, briefingTone]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/user/profile', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.profile) {
        const dashboardState = data.profile.dashboardState;
        const hasDashboardState = dashboardState !== null && typeof dashboardState === 'object' && !Array.isArray(dashboardState);

        const normalizedProfile: LoadedProfile = {
          grade: Number(data.profile.grade) || 0,
          income: Number(data.profile.income) || 11,
          gpa: Number(data.profile.gpa) || 0,
        };
        setLoadedProfile(normalizedProfile);
        // Auto-apply filters as requested
        setFilterProfile({
          grade: normalizedProfile.grade,
          income: normalizedProfile.income,
          gpa: normalizedProfile.gpa
        });

        if (hasDashboardState) {
          const rawDashboardState = dashboardState as Record<string, unknown>;
          if (Object.prototype.hasOwnProperty.call(rawDashboardState, 'readNoticeIds')) {
            const remoteReadNoticeIds = normalizeReadNoticeIds(rawDashboardState.readNoticeIds);
            setReadNoticeIds(remoteReadNoticeIds);
            localStorage.setItem(READ_NOTICE_IDS_KEY, JSON.stringify(remoteReadNoticeIds));
          }
          if (Object.prototype.hasOwnProperty.call(rawDashboardState, 'widgetOrder')) {
            const remoteWidgetOrder = normalizeWidgetOrder(rawDashboardState.widgetOrder);
            setWidgetOrder(remoteWidgetOrder);
            localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(remoteWidgetOrder));
          }
          if (Object.prototype.hasOwnProperty.call(rawDashboardState, 'enabledWidgets')) {
            const remoteEnabledWidgets = normalizeEnabledWidgets(rawDashboardState.enabledWidgets);
            setEnabledWidgets(remoteEnabledWidgets);
            localStorage.setItem(WIDGET_ENABLED_KEY, JSON.stringify(remoteEnabledWidgets));
          }
        }

        if (hasDashboardState) {
          const rawDashboardState = dashboardState as Record<string, unknown>;
          const rawBriefing =
            rawDashboardState.briefing ??
            rawDashboardState.briefingOptions ??
            rawDashboardState.briefingSettings;
          if (rawBriefing && typeof rawBriefing === 'object' && !Array.isArray(rawBriefing)) {
            const briefingState = rawBriefing as Record<string, unknown>;
            const tone = normalizeBriefingTone(briefingState.tone);
            const length = normalizeBriefingLength(briefingState.length);
            const focusCategories = normalizeBriefingFocusCategories(briefingState.focusCategories);
            if (Object.prototype.hasOwnProperty.call(briefingState, 'tone')) {
              setBriefingTone(tone);
            }
            if (Object.prototype.hasOwnProperty.call(briefingState, 'length')) {
              setBriefingLength(length);
            }
            if (Object.prototype.hasOwnProperty.call(briefingState, 'focusCategories')) {
              setBriefingFocusCategories(focusCategories);
            }
          }
        }

        allowDashboardSyncRef.current = true;
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchPresets = useCallback(async () => {
    try {
      const res = await fetch('/api/user/presets', { cache: 'no-store' });
      const data = await res.json();
      if (!data.success) return;
      setPresets(Array.isArray(data.presets) ? data.presets : []);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  }, []);

  const savePreset = useCallback(async () => {
    const presetName = window.prompt('프리셋 이름을 입력하세요', selectedCategory === 'ALL' ? '내 추천 프리셋' : `${selectedCategory} 프리셋`);
    const trimmedName = String(presetName || '').trim();
    if (!trimmedName) return;

    const categories = selectedCategory !== 'ALL' ? [selectedCategory] : [];
    const profileOverrides = recommendationPreviewEnabled
      ? {
        grade: filterProfile.grade > 0 ? filterProfile.grade : undefined,
        income: filterProfile.income <= 10 ? filterProfile.income : undefined,
        gpa: filterProfile.gpa > 0 ? filterProfile.gpa : undefined,
      }
      : undefined;

    setPresetBusy(true);
    try {
      const res = await fetch('/api/user/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          categories,
          tags: selectedTags,
          profileOverrides,
        }),
      });
      const data = await res.json();
      if (!data.success || !data.preset) return;
      await fetchPresets();
      setActivePresetId(Number(data.preset.id));
    } catch (error) {
      console.error('Failed to save preset:', error);
    } finally {
      setPresetBusy(false);
    }
  }, [fetchPresets, filterProfile.grade, filterProfile.gpa, filterProfile.income, recommendationPreviewEnabled, selectedCategory, selectedTags]);

  const deletePreset = useCallback(async () => {
    if (!activePresetId) return;
    const confirmed = window.confirm('선택한 프리셋을 삭제할까요?');
    if (!confirmed) return;

    setPresetBusy(true);
    try {
      const res = await fetch(`/api/user/presets?id=${activePresetId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) return;
      setActivePresetId(null);
      await fetchPresets();
    } catch (error) {
      console.error('Failed to delete preset:', error);
    } finally {
      setPresetBusy(false);
    }
  }, [activePresetId, fetchPresets]);

  const setNoticeAction = useCallback(async (noticeId: number, state: NoticeActionState) => {
    setActionBusyNoticeId(noticeId);
    try {
      const res = await fetch('/api/notices/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noticeId, state }),
      });
      const data = await res.json();
      if (!data.success) return;
      setNotices((prev) => prev.map((notice) => (
        notice.id === noticeId
          ? { ...notice, actionState: state }
          : notice
      )));
      setSelectedNotice((prev) => (prev && prev.id === noticeId ? { ...prev, actionState: state } : prev));
    } catch (error) {
      console.error('Failed to update notice action:', error);
    } finally {
      setActionBusyNoticeId(null);
    }
  }, []);

  const toggleNoticeFavorite = useCallback(async (noticeId: number, nextValue: boolean) => {
    setFavoriteBusyNoticeId(noticeId);
    try {
      const res = await fetch('/api/notices/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noticeId, isFavorite: nextValue }),
      });
      const data = await res.json();
      if (!data.success) return;
      const confirmedFavorite = Boolean(data.isFavorite);
      setNotices((prev) => prev
        .map((notice) => (notice.id === noticeId ? { ...notice, isFavorite: confirmedFavorite } : notice))
        .filter((notice) => (favoriteOnly ? Boolean(notice.isFavorite) : true)));
      setSelectedNotice((prev) => (prev && prev.id === noticeId ? { ...prev, isFavorite: confirmedFavorite } : prev));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    } finally {
      setFavoriteBusyNoticeId(null);
    }
  }, [favoriteOnly]);

  const downloadNoticeCalendar = useCallback((notice: Notice) => {
    if (!notice.deadline) {
      window.alert('마감일이 없는 공지는 캘린더로 추가할 수 없습니다.');
      return;
    }
    const link = document.createElement('a');
    link.href = `/api/notices/${notice.id}/calendar.ics`;
    link.download = `notice-${notice.id}-deadline.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const shareNotice = useCallback(async (notice: Notice) => {
    const shareUrl = notice.url;
    const shareTitle = `[MySchoolMate] ${notice.title}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: shareTitle,
          text: `${notice.title}\n${shareUrl}`,
          url: shareUrl,
        });
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareTitle}\n${shareUrl}`);
        window.alert('공유 링크를 복사했습니다.');
        return;
      }

      window.prompt('링크를 복사하세요', `${shareTitle}\n${shareUrl}`);
    } catch (error) {
      console.error('Failed to share notice:', error);
    }
  }, []);

  const getDeadlineCalendarFeedUrl = useCallback(() => {
    const params = new URLSearchParams({
      withinDays: '120',
      limit: '180',
    });
    return `/api/deadlines/calendar.ics?${params.toString()}`;
  }, []);

  const downloadDeadlineCalendarFeed = useCallback(() => {
    const link = document.createElement('a');
    link.href = getDeadlineCalendarFeedUrl();
    link.download = 'myschoolmate-deadlines.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [getDeadlineCalendarFeedUrl]);

  const copyDeadlineCalendarFeedUrl = useCallback(async () => {
    const relative = getDeadlineCalendarFeedUrl();
    const absolute = `${window.location.origin}${relative}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absolute);
        window.alert('캘린더 구독 링크를 복사했습니다.');
        return;
      }
      window.prompt('캘린더 구독 링크를 복사하세요', absolute);
    } catch (error) {
      console.error('Failed to copy deadline calendar feed url:', error);
      window.prompt('캘린더 구독 링크를 복사하세요', absolute);
    }
  }, [getDeadlineCalendarFeedUrl]);

  const ensureServiceWorkerRegistration = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
    if (serviceWorkerRegRef.current) return serviceWorkerRegRef.current;

    await navigator.serviceWorker.register('/sw.js');
    const ready = await navigator.serviceWorker.ready;
    serviceWorkerRegRef.current = ready;
    return ready;
  }, []);

  useEffect(() => {
    if (!clientStateHydrated) return;
    if (typeof window === 'undefined') return;

    const supported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
    setWebPushSupported(supported);
    if (!supported) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/alerts/push/public-key', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;

        const configured = Boolean(data?.enabled && typeof data?.publicKey === 'string' && data.publicKey.length > 0);
        setWebPushConfigured(configured);
        setWebPushPublicKey(configured ? String(data.publicKey) : null);

        if (!configured) return;

        const registration = await ensureServiceWorkerRegistration();
        if (!registration || cancelled) return;

        const subscription = await registration.pushManager.getSubscription();
        if (cancelled) return;
        const subscribed = Boolean(subscription);
        setWebPushSubscribed(subscribed);
        if (subscribed) {
          setBrowserNotificationsEnabled(true);
        }
      } catch (error) {
        console.error('Failed to initialize web push:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientStateHydrated, ensureServiceWorkerRegistration]);

  const toggleBrowserNotifications = useCallback(async () => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      window.alert('현재 브라우저는 알림 기능을 지원하지 않습니다.');
      return;
    }

    if (webPushSupported && webPushConfigured && webPushPublicKey) {
      setWebPushBusy(true);
      try {
        const registration = await ensureServiceWorkerRegistration();
        if (!registration) {
          window.alert('서비스워커 등록에 실패했습니다.');
          return;
        }

        if (webPushSubscribed) {
          const existing = await registration.pushManager.getSubscription();
          const endpoint = existing?.endpoint || null;
          if (existing) {
            await existing.unsubscribe();
          }
          if (endpoint) {
            await fetch('/api/alerts/push/unsubscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint }),
            });
          }
          setWebPushSubscribed(false);
          setBrowserNotificationsEnabled(false);
          return;
        }

        if (Notification.permission === 'denied') {
          window.alert('브라우저 설정에서 알림 권한을 허용한 뒤 다시 시도해 주세요.');
          return;
        }

        let permission: NotificationPermission = Notification.permission;
        if (permission !== 'granted') {
          permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') {
          window.alert('알림 권한이 허용되지 않아 웹푸시 구독을 진행할 수 없습니다.');
          return;
        }

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8Array(webPushPublicKey),
          });
        }

        const subscribeRes = await fetch('/api/alerts/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: subscription.toJSON() }),
        });
        const subscribeJson = await subscribeRes.json().catch(() => ({}));
        if (!subscribeRes.ok || !subscribeJson.success) {
          throw new Error(subscribeJson.error || 'subscribe failed');
        }

        setWebPushSubscribed(true);
        setBrowserNotificationsEnabled(true);
        return;
      } catch (error) {
        console.error('Failed to toggle web push subscription:', error);
        window.alert('웹푸시 구독 처리 중 오류가 발생했습니다.');
        return;
      } finally {
        setWebPushBusy(false);
      }
    }

    if (browserNotificationsEnabled) {
      setBrowserNotificationsEnabled(false);
      return;
    }

    if (Notification.permission === 'granted') {
      setBrowserNotificationsEnabled(true);
      return;
    }

    if (Notification.permission === 'denied') {
      window.alert('브라우저 설정에서 알림 권한을 허용한 뒤 다시 시도해 주세요.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setBrowserNotificationsEnabled(true);
      return;
    }
    window.alert('알림 권한이 허용되지 않아 브라우저 알림을 켤 수 없습니다.');
  }, [
    browserNotificationsEnabled,
    ensureServiceWorkerRegistration,
    webPushConfigured,
    webPushPublicKey,
    webPushSubscribed,
    webPushSupported,
  ]);

  const loadNotices = useCallback(async (options?: { autoCrawl?: boolean; waitForCrawl?: boolean; rethrow?: boolean }) => {
    const queryParams = new URLSearchParams();
    queryParams.set('autoCrawl', options?.autoCrawl ? '1' : '0');
    if (options?.waitForCrawl) {
      queryParams.set('waitForCrawl', '1');
    }
    queryParams.set('limit', String(NOTICE_FETCH_LIMIT));
    queryParams.set('sort', sortMode);
    if (deadlineWithinDays !== null) {
      queryParams.set('deadlineWithinDays', String(deadlineWithinDays));
    }
    if (favoriteOnly) {
      queryParams.set('favoriteOnly', '1');
    }
    if (watchlistOnly) {
      queryParams.set('watchlistOnly', '1');
    }
    if (activePresetId !== null) {
      queryParams.set('presetId', String(activePresetId));
    }
    selectedTags.forEach((tag) => queryParams.append('tags', tag));
    if (selectedTags.length > 0) {
      queryParams.set('tagMode', tagMode);
    }
    if (recommendationPreviewEnabled) {
      if (filterProfile.grade >= 1 && filterProfile.grade <= 4) {
        queryParams.set('previewGrade', String(filterProfile.grade));
      }
      if (filterProfile.income >= 0 && filterProfile.income <= 10) {
        queryParams.set('previewIncome', String(filterProfile.income));
      }
      if (filterProfile.gpa > 0) {
        queryParams.set('previewGpa', String(filterProfile.gpa));
      }
    }

    const url = `/api/notices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `notice load failed (${res.status})`);
      }

      if (data.success) {
        if (data.autoCrawler) {
          setAutoCrawlerStatus(data.autoCrawler);
        }
        const incomingNotices = dedupeNoticesById(
          (Array.isArray(data.notices) ? data.notices : []).map((notice: Notice) => ({
            ...notice,
            tags: normalizeNoticeTags(notice.tags),
            relevanceScore: Number.isFinite(Number(notice.relevanceScore)) ? Number(notice.relevanceScore) : undefined,
            relevanceReasons: normalizeRelevanceReasons(notice.relevanceReasons),
            actionState: normalizeNoticeActionState(notice.actionState),
            isFavorite: Boolean(notice.isFavorite),
            isUrgent: Boolean(notice.isUrgent),
            dday: notice.dday === null || notice.dday === undefined
              ? null
              : (Number.isFinite(Number(notice.dday)) ? Number(notice.dday) : null),
            favoriteCount: Number.isFinite(Number(notice.favoriteCount)) ? Number(notice.favoriteCount) : 0,
            isEasyToMiss: Boolean(notice.isEasyToMiss),
            matchesWatchlist: Boolean(notice.matchesWatchlist),
          }))
        );
        setNotices(incomingNotices);

        // First-run baseline: treat currently loaded notices as read,
        // so inbox only highlights newly arrived notices afterward.
        if (
          incomingNotices.length > 0 &&
          selectedTags.length === 0 &&
          localStorage.getItem(NOTICE_BASELINE_KEY) !== '1'
        ) {
          setReadNoticeIds((prev) => {
            const next = Array.from(new Set([...prev, ...incomingNotices.map((notice) => notice.id)]));
            queueDashboardSync({ readNoticeIds: next });
            return next;
          });
          localStorage.setItem(NOTICE_BASELINE_KEY, '1');
        }
      }
      return data;
    } catch (error) {
      console.error('Failed to load notices:', error);
      if (options?.rethrow) {
        throw error;
      }
      return null;
    }
  }, [
    activePresetId,
    deadlineWithinDays,
    favoriteOnly,
    watchlistOnly,
    filterProfile.gpa,
    filterProfile.grade,
    filterProfile.income,
    queueDashboardSync,
    recommendationPreviewEnabled,
    selectedTags,
    sortMode,
    tagMode,
  ]);

  useEffect(() => {
    const savedSelectedTags = localStorage.getItem(NOTICE_SELECTED_TAGS_KEY);
    if (savedSelectedTags) {
      try {
        setSelectedTags(normalizeTagList(JSON.parse(savedSelectedTags)));
      } catch {
        setSelectedTags([]);
      }
    }

    const savedTagMode = localStorage.getItem(NOTICE_TAG_MODE_KEY);
    if (savedTagMode !== null) {
      setTagMode(normalizeTagMode(savedTagMode));
    }

    const savedSortMode = localStorage.getItem(NOTICE_SORT_MODE_KEY);
    if (savedSortMode === 'latest' || savedSortMode === 'relevance' || savedSortMode === 'deadline') {
      setSortMode(savedSortMode);
    }

    const savedDeadlineWindow = localStorage.getItem(NOTICE_DEADLINE_WINDOW_KEY);
    if (savedDeadlineWindow !== null) {
      const parsed = Number(savedDeadlineWindow);
      if (Number.isFinite(parsed) && parsed > 0) {
        setDeadlineWithinDays(Math.trunc(parsed));
      } else {
        setDeadlineWithinDays(null);
      }
    }

    const savedFavoriteOnly = localStorage.getItem(NOTICE_FAVORITE_ONLY_KEY);
    if (savedFavoriteOnly !== null) {
      setFavoriteOnly(savedFavoriteOnly === '1');
    }

    const savedWatchlistOnly = localStorage.getItem(NOTICE_WATCHLIST_ONLY_KEY);
    if (savedWatchlistOnly !== null) {
      setWatchlistOnly(savedWatchlistOnly === '1');
    }

    const savedBrowserNotifications = localStorage.getItem(NOTICE_BROWSER_NOTIFICATIONS_KEY);
    if (savedBrowserNotifications !== null) {
      setBrowserNotificationsEnabled(savedBrowserNotifications === '1');
    }

    const savedPresetId = localStorage.getItem(NOTICE_ACTIVE_PRESET_KEY);
    if (savedPresetId !== null) {
      const parsed = Number(savedPresetId);
      if (Number.isInteger(parsed) && parsed > 0) {
        setActivePresetId(parsed);
      }
    }

    const savedPreviewEnabled = localStorage.getItem(NOTICE_RECOMMEND_PREVIEW_KEY);
    if (savedPreviewEnabled !== null) {
      setRecommendationPreviewEnabled(savedPreviewEnabled === '1');
    }

    const savedBriefingTone = localStorage.getItem(BRIEFING_TONE_KEY);
    if (savedBriefingTone !== null) {
      setBriefingTone(normalizeBriefingTone(savedBriefingTone));
    }

    const savedBriefingLength = localStorage.getItem(BRIEFING_LENGTH_KEY);
    if (savedBriefingLength !== null) {
      setBriefingLength(normalizeBriefingLength(savedBriefingLength));
    }

    const savedBriefingFocus = localStorage.getItem(BRIEFING_FOCUS_KEY);
    if (savedBriefingFocus) {
      try {
        setBriefingFocusCategories(normalizeBriefingFocusCategories(JSON.parse(savedBriefingFocus)));
      } catch {
        setBriefingFocusCategories([]);
      }
    }

    const savedReadNoticeIds = localStorage.getItem(READ_NOTICE_IDS_KEY);
    if (savedReadNoticeIds) {
      try {
        const parsed = JSON.parse(savedReadNoticeIds);
        setReadNoticeIds(Array.isArray(parsed) ? parsed.filter((value) => Number.isInteger(value)) : []);
      } catch {
        setReadNoticeIds([]);
      }
    }

    const savedNotifiedNewIds = localStorage.getItem(NOTICE_NOTIFIED_NEW_IDS_KEY);
    if (savedNotifiedNewIds) {
      try {
        const parsed = JSON.parse(savedNotifiedNewIds);
        notifiedNewNoticeIdsRef.current = new Set(normalizeReadNoticeIds(parsed));
      } catch {
        notifiedNewNoticeIdsRef.current = new Set();
      }
    }

    const savedNotifiedUrgentIds = localStorage.getItem(NOTICE_NOTIFIED_URGENT_IDS_KEY);
    if (savedNotifiedUrgentIds) {
      try {
        const parsed = JSON.parse(savedNotifiedUrgentIds);
        notifiedUrgentNoticeIdsRef.current = new Set(normalizeReadNoticeIds(parsed));
      } catch {
        notifiedUrgentNoticeIdsRef.current = new Set();
      }
    }

    const savedWidgetOrder = localStorage.getItem(WIDGET_ORDER_KEY);
    if (savedWidgetOrder) {
      try {
        setWidgetOrder(normalizeWidgetOrder(JSON.parse(savedWidgetOrder)));
      } catch {
        setWidgetOrder([...FALLBACK_WIDGET_ORDER]);
      }
    }

    const savedEnabledWidgets = localStorage.getItem(WIDGET_ENABLED_KEY);
    if (savedEnabledWidgets) {
      try {
        setEnabledWidgets(normalizeEnabledWidgets(JSON.parse(savedEnabledWidgets)));
      } catch {
        setEnabledWidgets({ ...FALLBACK_WIDGET_ENABLED });
      }
    }

    setClientStateHydrated(true);
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchProfile();
      await fetchPresets();
    })();
  }, [fetchPresets, fetchProfile]);

  useEffect(() => {
    if (!loadedProfile) return;
    if (!clientStateHydrated) return;
    if (initialBriefingLoadedRef.current) return;
    initialBriefingLoadedRef.current = true;
    void fetchBriefing();
  }, [clientStateHydrated, fetchBriefing, loadedProfile]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    localStorage.setItem(READ_NOTICE_IDS_KEY, JSON.stringify(readNoticeIds));
  }, [readNoticeIds, clientStateHydrated]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    localStorage.setItem(NOTICE_SELECTED_TAGS_KEY, JSON.stringify(selectedTags));
  }, [selectedTags, clientStateHydrated]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    localStorage.setItem(NOTICE_TAG_MODE_KEY, tagMode);
  }, [tagMode, clientStateHydrated]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    localStorage.setItem(NOTICE_SORT_MODE_KEY, sortMode);
  }, [sortMode, clientStateHydrated]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    localStorage.setItem(NOTICE_DEADLINE_WINDOW_KEY, deadlineWithinDays === null ? '' : String(deadlineWithinDays));
  }, [deadlineWithinDays, clientStateHydrated]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    localStorage.setItem(NOTICE_FAVORITE_ONLY_KEY, favoriteOnly ? '1' : '0');
  }, [favoriteOnly, clientStateHydrated]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    localStorage.setItem(NOTICE_WATCHLIST_ONLY_KEY, watchlistOnly ? '1' : '0');
  }, [watchlistOnly, clientStateHydrated]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    localStorage.setItem(NOTICE_BROWSER_NOTIFICATIONS_KEY, browserNotificationsEnabled ? '1' : '0');
  }, [browserNotificationsEnabled, clientStateHydrated]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    localStorage.setItem(NOTICE_ACTIVE_PRESET_KEY, activePresetId === null ? '' : String(activePresetId));
  }, [activePresetId, clientStateHydrated]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    localStorage.setItem(NOTICE_RECOMMEND_PREVIEW_KEY, recommendationPreviewEnabled ? '1' : '0');
  }, [recommendationPreviewEnabled, clientStateHydrated]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    localStorage.setItem(BRIEFING_TONE_KEY, briefingTone ?? '');
  }, [briefingTone, clientStateHydrated]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    localStorage.setItem(BRIEFING_LENGTH_KEY, briefingLength ?? '');
  }, [briefingLength, clientStateHydrated]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    localStorage.setItem(BRIEFING_FOCUS_KEY, JSON.stringify(briefingFocusCategories));
  }, [briefingFocusCategories, clientStateHydrated]);

  useEffect(() => {
    if (activePresetId === null) return;
    if (presets.some((preset) => preset.id === activePresetId)) return;
    setActivePresetId(null);
  }, [activePresetId, presets]);

  useEffect(() => {
    if (!clientStateHydrated) return;
    queueDashboardSync({
      briefing: {
        tone: briefingTone ?? undefined,
        length: briefingLength ?? undefined,
        focusCategories: briefingFocusCategories.length > 0 ? briefingFocusCategories : undefined,
      },
    });
  }, [briefingFocusCategories, briefingLength, briefingTone, clientStateHydrated, queueDashboardSync]);

  useEffect(() => {
    if (activePresetId === null) return;
    const preset = presets.find((item) => item.id === activePresetId);
    if (!preset) return;

    setSelectedTags((prev) => (JSON.stringify(prev) === JSON.stringify(preset.tags) ? prev : preset.tags));

    const firstCategory = preset.categories[0];
    if (firstCategory === 'Academic' || firstCategory === 'Scholarship' || firstCategory === 'General' || firstCategory === 'Employment' || firstCategory === 'News') {
      setSelectedCategory(firstCategory);
    } else {
      setSelectedCategory('ALL');
    }

    if (recommendationPreviewEnabled && preset.profileOverrides) {
      setFilterProfile((prev) => ({
        grade: typeof preset.profileOverrides?.grade === 'number' ? preset.profileOverrides.grade : prev.grade,
        income: typeof preset.profileOverrides?.income === 'number' ? preset.profileOverrides.income : prev.income,
        gpa: typeof preset.profileOverrides?.gpa === 'number' ? preset.profileOverrides.gpa : prev.gpa,
      }));
    }
  }, [activePresetId, presets, recommendationPreviewEnabled]);

  useEffect(() => {
    void loadNotices();
  }, [loadNotices]);

  useEffect(() => {
    if (!selectedNotice) return;
    const latest = notices.find((notice) => notice.id === selectedNotice.id);
    if (!latest) return;
    setSelectedNotice(latest);
  }, [notices, selectedNotice]);

  const saveWidgetOrder = (newOrder: string[]) => {
    const normalized = normalizeWidgetOrder(newOrder);
    setWidgetOrder(normalized);
    localStorage.setItem(WIDGET_ORDER_KEY, JSON.stringify(normalized));
    queueDashboardSync({ widgetOrder: normalized });
  };

  const toggleWidget = (id: string) => {
    const newEnabled = { ...enabledWidgets, [id]: !enabledWidgets[id] };
    setEnabledWidgets(newEnabled);
    localStorage.setItem(WIDGET_ENABLED_KEY, JSON.stringify(newEnabled));
    queueDashboardSync({ enabledWidgets: newEnabled as DashboardState['enabledWidgets'] });
  };

  const moveWidget = (id: string, direction: 'up' | 'down') => {
    const index = widgetOrder.indexOf(id);
    if (index === -1) return;
    const newOrder = [...widgetOrder];
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
    }
    saveWidgetOrder(newOrder);
  };

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [selectedCategory, searchQuery, filterProfile, selectedTags, tagMode, sortMode, deadlineWithinDays, favoriteOnly, watchlistOnly, activePresetId]);

  async function refreshNotices() {
    setLoading(true);
    setRefreshMessage('최신 공지를 확인하고 있어요.');
    try {
      const data = await loadNotices({ autoCrawl: true, waitForCrawl: true, rethrow: true });
      if (data?.freshnessError) {
        setRefreshMessage('공지 목록은 다시 불러왔고, 새 수집은 잠시 지연 중입니다.');
      } else if (data?.freshness?.triggered) {
        setRefreshMessage('새 공지 수집을 반영했어요.');
      } else if (data?.freshness?.reason === 'fresh') {
        setRefreshMessage('이미 최신 상태입니다.');
      } else if (data?.freshness?.reason === 'cooldown') {
        setRefreshMessage('방금 확인한 상태라 잠시 뒤 다시 시도할 수 있어요.');
      } else if (data?.freshness?.reason === 'already-running') {
        setRefreshMessage('공지 수집이 이미 진행 중입니다.');
      } else {
        setRefreshMessage('공지 목록을 다시 불러왔어요.');
      }
      fetchBriefing();
    } catch (error) {
      console.error('Failed to refresh:', error);
      setRefreshMessage('새로고침에 실패했습니다. 잠시 뒤 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenNotice = useCallback((notice: Notice) => {
    setSelectedNotice(notice);
    setIsDialogOpen(true);
    setReadNoticeIds((prev) => {
      if (prev.includes(notice.id)) return prev;
      const next = [...prev, notice.id];
      queueDashboardSync({ readNoticeIds: next });
      return next;
    });
  }, [queueDashboardSync]);

  const applySearchSuggestion = useCallback((suggestion: string) => {
    const nextQuery = suggestion.startsWith('#') ? suggestion.slice(1) : suggestion;
    setSearchQuery(nextQuery);
  }, []);

  const toggleBriefingFocusCategory = useCallback((category: BriefingCategory) => {
    setBriefingFocusCategories((prev) => (
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    ));
  }, []);

  const resetBriefingTuning = useCallback(() => {
    setBriefingTone(null);
    setBriefingLength(null);
    setBriefingFocusCategories([]);
    setIsBriefingTuningOpen(false);
    void fetchBriefing({
      tone: null,
      length: null,
      focusCategories: [],
    });
  }, [fetchBriefing]);

  const refreshBriefingWithTuning = useCallback(() => {
    void fetchBriefing();
  }, [fetchBriefing]);

  const askNoticeQuestion = useCallback(async (rawQuestion: string): Promise<NoticeChatAskResult> => {
    const nextQuestion = String(rawQuestion || '').trim();
    if (!nextQuestion) return null;

    setChatQuestion(nextQuestion);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: nextQuestion }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.error || '공지 Q&A 요청 실패'));
      }

      const answer = String(data.answer || '').trim();
      const normalizedCitations = normalizeChatCitations(data.citations);
      const suggestedKeywords = normalizeTagList(data.suggestedKeywords);
      const resolvedAnswer = answer || '해당 공지를 찾지 못했어.';
      setChatAnswer(resolvedAnswer);
      setChatCitations(normalizedCitations);
      setChatSuggestedKeywords(suggestedKeywords);
      return {
        answer: resolvedAnswer,
        citations: normalizedCitations,
        suggestedKeywords,
      };
    } catch (error) {
      console.error('Failed to ask notice question:', error);
      const fallbackAnswer = '해당 공지를 찾지 못했어. 잠시 후 다시 시도해줘.';
      const fallbackKeywords = ['장학', '인턴', '마감', '신청 자격'];
      setChatAnswer(fallbackAnswer);
      setChatCitations([]);
      setChatSuggestedKeywords(fallbackKeywords);
      return {
        answer: fallbackAnswer,
        citations: [],
        suggestedKeywords: fallbackKeywords,
      };
    } finally {
      setChatLoading(false);
    }
  }, []);

  // Filter & Search Logic
  const filteredNotices = useMemo(() => {
    return [...notices].filter((n) => {
        // 1. Search Query
        if (searchQuery) {
          const searchLower = searchQuery.toLowerCase();
          const inTitle = n.title.toLowerCase().includes(searchLower);
          const inContent = n.content?.toLowerCase().includes(searchLower) || false;
          if (!inTitle && !inContent) return false;
        }

        // 2. Category Filter with Smart Academic/Scholarship Separation
        if (selectedCategory !== 'ALL') {
          const lowerCat = n.category.toLowerCase();
          const isMixed = lowerCat.includes('academic') && lowerCat.includes('scholarship');
          // Scholarship signals: AI detected Tuition/LivingSupport type, or title contains 장학/지원금
          const isScholarshipSignal =
            (n.scholarshipType && n.scholarshipType !== 'Other' && n.scholarshipType !== 'Program' && n.scholarshipType !== 'Job') ||
            n.title.includes('장학') ||
            n.title.includes('지원금') ||
            n.title.includes('성적장학');

          if (selectedCategory === 'Academic') {
            if (isMixed) {
              // In mixed category, show only NON-scholarship items
              if (isScholarshipSignal) return false;
            } else if (!lowerCat.includes('academic')) {
              return false;
            }
          } else if (selectedCategory === 'Scholarship') {
            if (isMixed) {
              // In mixed category, show only scholarship items
              if (!isScholarshipSignal) return false;
            } else if (!lowerCat.includes('scholarship')) {
              return false;
            }
          } else if (selectedCategory === 'General' && !lowerCat.includes('general')) {
            return false;
          } else if (selectedCategory === 'Employment' && !lowerCat.includes('employment')) {
            return false;
          } else if (selectedCategory === 'News' && !lowerCat.includes('news')) {
            return false;
          }
        }

        // 3. User Profile Filters
        if (n.minGrade && filterProfile.grade > 0 && filterProfile.grade < n.minGrade) return false;
        if (n.maxIncome !== null && n.maxIncome !== undefined && filterProfile.income !== 11) {
          // If user selected a specific bracket (0-10), filter out any notices that require a stricter bracket than the user has.
          // e.g. User is 9. Notice requires 8 (maxIncome=8). 9 > 8 -> Hide.
          // e.g. User is 3. Notice requires 5. 3 <= 5 -> Show.
          if (filterProfile.income > n.maxIncome) return false;
        }
        if (filterProfile.gpa && n.minGpa && filterProfile.gpa < n.minGpa) return false;

        return true;
      });
  }, [notices, searchQuery, selectedCategory, filterProfile]);

  const pinnedNotices = useMemo(() => notices.filter((n) => n.isPinned), [notices]);
  const regularNotices = useMemo(() => filteredNotices.filter((n) => !n.isPinned), [filteredNotices]);
  const noticeLookup = useMemo(() => new Map(notices.map((notice) => [notice.id, notice])), [notices]);
  const readNoticeSet = useMemo(() => new Set(readNoticeIds), [readNoticeIds]);
  const availableTags = useMemo(() => {
    const tagMap = new Map<string, { slug: string; name: string }>();
    for (const notice of notices) {
      for (const tag of notice.tags || []) {
        if (!tag || !tag.slug) continue;
        tagMap.set(tag.slug, { slug: tag.slug, name: tag.name || tag.slug });
      }
    }
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
  }, [notices]);

  const availableTagNameBySlug = useMemo(() => {
    return new Map(availableTags.map((tag) => [tag.slug, tag.name] as const));
  }, [availableTags]);
  const searchSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length < 1) return [];

    const suggestions = new Set<string>();
    for (const notice of notices) {
      const title = String(notice.title || '').trim();
      if (title && title.toLowerCase().includes(query)) {
        suggestions.add(title);
      }

      for (const tag of notice.tags || []) {
        const label = getNoticeTagLabel(tag).trim();
        if (!label) continue;
        if (label.toLowerCase().includes(query)) {
          suggestions.add(`#${label}`);
        }
      }

      if (suggestions.size >= 8) break;
    }

    return Array.from(suggestions).slice(0, 8);
  }, [notices, searchQuery]);
  const noticeChatSuggestions = useMemo(() => {
    const categoryScoped = notices.filter((notice) => {
      const categoryText = String(notice.category || '').toLowerCase();
      if (selectedCategory === 'ALL') return true;
      if (selectedCategory === 'Academic') {
        if (!categoryText.includes('academic')) return false;
        return !isScholarshipNotice(notice);
      }
      if (selectedCategory === 'Scholarship') return isScholarshipNotice(notice);
      if (selectedCategory === 'Employment') return isEmploymentNotice(notice);
      if (selectedCategory === 'General') return categoryText.includes('general');
      if (selectedCategory === 'News') return categoryText.includes('news');
      return true;
    });
    const scopedNotices = categoryScoped.length > 0 ? categoryScoped : notices;
    const suggestions = new Set<string>();

    const profileTokens: string[] = [];
    if (filterProfile.grade > 0) profileTokens.push(`${filterProfile.grade}학년`);
    if (filterProfile.income <= 10) profileTokens.push(`${filterProfile.income}분위`);
    if (filterProfile.gpa > 0) profileTokens.push(`평점 ${filterProfile.gpa.toFixed(1)}`);
    const profilePrefix = profileTokens.length > 0 ? `${profileTokens.join(' ')} 기준으로 ` : '';

    const addSuggestion = (value?: string | null) => {
      const normalized = String(value || '').trim();
      if (normalized.length > 0) {
        suggestions.add(normalized);
      }
    };

    const upcomingCandidates = scopedNotices
      .map((notice) => {
        const parsed = parseDeadline(notice.deadline);
        const dday = typeof notice.dday === 'number' ? notice.dday : parsed ? getDday(parsed) : null;
        return { notice, dday };
      })
      .filter((entry): entry is { notice: Notice; dday: number } => typeof entry.dday === 'number' && entry.dday >= 0)
      .sort((a, b) => a.dday - b.dday)
      .map((entry) => entry.notice);
    const scholarshipCandidates = scopedNotices.filter((notice) => isScholarshipNotice(notice));
    const employmentCandidates = scopedNotices.filter((notice) => isEmploymentNotice(notice));
    const relevanceCandidates = [...scopedNotices].sort(
      (a, b) => (Number(b.relevanceScore) || 0) - (Number(a.relevanceScore) || 0),
    );

    if (scholarshipCandidates[0]) {
      const title = compactTitleForSuggestion(scholarshipCandidates[0].title);
      addSuggestion(`${profilePrefix}${title} 신청 가능 여부랑 준비 서류만 확인해줘`);
    }
    if (employmentCandidates[0]) {
      const title = compactTitleForSuggestion(employmentCandidates[0].title);
      addSuggestion(`${title} 지원 자격, 일정, 준비물만 요약해줘`);
    }
    if (upcomingCandidates[0]) {
      const title = compactTitleForSuggestion(upcomingCandidates[0].title);
      addSuggestion(`${title} 마감일까지 지금 해야 할 일을 순서대로 알려줘`);
    }
    if (relevanceCandidates[0]) {
      const title = compactTitleForSuggestion(relevanceCandidates[0].title);
      addSuggestion(`${title}에서 놓치면 안 되는 포인트 3개만 알려줘`);
    }

    const tagCounts = new Map<string, number>();
    for (const notice of scopedNotices.slice(0, 80)) {
      for (const tag of notice.tags || []) {
        const label = getNoticeTagLabel(tag).trim();
        if (!label) continue;
        tagCounts.set(label, (tagCounts.get(label) || 0) + 1);
      }
    }
    const topTag = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (topTag) {
      addSuggestion(`이번 주 ${topTag} 관련 공지 중 우선순위 높은 것만 골라줘`);
    }

    const categoryLabel = toCategoryLabel(selectedCategory);
    addSuggestion(`${categoryLabel} 공지 기준으로 오늘 확인해야 할 공지 3개만 추천해줘`);
    addSuggestion('마감 임박 공지를 기준으로 이번 주 할 일 체크리스트 만들어줘');

    return Array.from(suggestions).slice(0, 4);
  }, [filterProfile.gpa, filterProfile.grade, filterProfile.income, notices, selectedCategory]);
  const browserNotificationPermissionLabel = (() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return '미지원';
    if (Notification.permission === 'granted') return '허용됨';
    if (Notification.permission === 'denied') return '차단됨';
    return '요청 전';
  })();
  const browserNotificationModeLabel = (() => {
    if (!webPushSupported) return '브라우저 미지원';
    if (webPushConfigured) return webPushSubscribed ? '웹푸시 구독중' : '웹푸시 사용 가능';
    return '로컬 알림 모드';
  })();
  const unreadNoticeCount = useMemo(
    () => notices.filter((notice) => !readNoticeSet.has(notice.id)).length,
    [notices, readNoticeSet]
  );

  const inboxItems = useMemo(() => {
    const items: InboxItem[] = [];

    for (const notice of notices) {
      if (notice.actionState === 'dismissed') continue;

      if (!readNoticeSet.has(notice.id)) {
        items.push({
          id: `new-${notice.id}`,
          noticeId: notice.id,
          type: 'NEW_NOTICE',
          title: notice.title,
          subtitle: '새 공지',
          priority: 2,
        });
      }

      const deadline = parseDeadline(notice.deadline);
      if (!deadline) continue;

      const dday = getDday(deadline);
      if (dday >= 0 && dday <= 7 && notice.actionState !== 'done') {
        items.push({
          id: `deadline-${notice.id}`,
          noticeId: notice.id,
          type: 'DEADLINE_SOON',
          title: notice.title,
          subtitle: dday === 0 ? '오늘 마감' : `마감 D-${dday}`,
          priority: 1,
        });
      }
    }

    return items
      .sort((a, b) => a.priority - b.priority || b.noticeId - a.noticeId)
      .slice(0, 12);
  }, [notices, readNoticeSet]);

  const urgentInboxCount = inboxItems.filter((item) => item.type === 'DEADLINE_SOON').length;
  const deadlineTimeline = useMemo(
    () => notices
      .filter((notice) => typeof notice.dday === 'number' && notice.dday >= 0 && notice.dday <= 14 && notice.actionState !== 'done' && notice.actionState !== 'dismissed')
      .sort((a, b) => {
        const aDday = typeof a.dday === 'number' ? a.dday : Number.POSITIVE_INFINITY;
        const bDday = typeof b.dday === 'number' ? b.dday : Number.POSITIVE_INFINITY;
        return aDday - bDday || (b.relevanceScore || 0) - (a.relevanceScore || 0);
      })
      .slice(0, 8),
    [notices],
  );
  const easyToMissNotices = useMemo(
    () => notices
      .filter((notice) => notice.isEasyToMiss && notice.actionState !== 'done' && notice.actionState !== 'dismissed')
      .filter((notice) => typeof notice.dday !== 'number' || notice.dday >= 0)
      .sort((a, b) => {
        const aDday = typeof a.dday === 'number' ? a.dday : Number.POSITIVE_INFINITY;
        const bDday = typeof b.dday === 'number' ? b.dday : Number.POSITIVE_INFINITY;
        return aDday - bDday || (b.relevanceScore || 0) - (a.relevanceScore || 0) || b.id - a.id;
      })
      .slice(0, 5),
    [notices],
  );
  const easyToMissCount = easyToMissNotices.length;
  const navInboxItems = useMemo(() => {
    const items: NavInboxItem[] = [...inboxItems];
    const existingNoticeIds = new Set(items.map((item) => item.noticeId));

    for (const notice of easyToMissNotices) {
      if (existingNoticeIds.has(notice.id)) continue;
      items.push({
        id: `easy-miss-${notice.id}`,
        noticeId: notice.id,
        type: 'EASY_TO_MISS' as const,
        title: notice.title,
        subtitle: typeof notice.dday === 'number' ? `놓치기 쉬움 · ${formatDdayLabel(notice.dday)}` : '놓치기 쉬운 공지',
        priority: 3,
      });
      existingNoticeIds.add(notice.id);
    }

    return items
      .sort((a, b) => a.priority - b.priority || b.noticeId - a.noticeId)
      .slice(0, 12);
  }, [easyToMissNotices, inboxItems]);
  const scholarshipComparisonNotices = useMemo(
    () => filteredNotices
      .filter((notice) => isScholarshipNotice(notice))
      .filter((notice) => notice.actionState !== 'dismissed')
      .filter((notice) => typeof notice.dday !== 'number' || notice.dday >= 0)
      .sort((a, b) => {
        const aDday = typeof a.dday === 'number' ? a.dday : Number.POSITIVE_INFINITY;
        const bDday = typeof b.dday === 'number' ? b.dday : Number.POSITIVE_INFINITY;
        return aDday - bDday || (b.relevanceScore || 0) - (a.relevanceScore || 0) || b.id - a.id;
      })
      .slice(0, 3),
    [filteredNotices],
  );
  const priorityActionNotices = useMemo(
    () => filteredNotices
      .filter((notice) => notice.actionState !== 'done' && notice.actionState !== 'dismissed')
      .filter((notice) => isActionableNotice(notice))
      .map((notice) => {
        const dday = getNoticeDday(notice);
        const deadlineWeight = typeof dday === 'number' && dday >= 0 ? Math.max(0, 40 - dday * 4) : 0;
        const unreadWeight = readNoticeSet.has(notice.id) ? 0 : 10;
        const easyMissWeight = notice.isEasyToMiss ? 12 : 0;
        const relevanceWeight = Math.min(45, Math.max(0, Number(notice.relevanceScore) || 0));
        return {
          notice,
          dday,
          score: deadlineWeight + unreadWeight + easyMissWeight + relevanceWeight,
        };
      })
      .sort((a, b) => b.score - a.score || (a.dday ?? 999) - (b.dday ?? 999) || b.notice.id - a.notice.id)
      .slice(0, 3),
    [filteredNotices, readNoticeSet],
  );
  const deadlineRadarDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      const label = offset === 0
        ? '오늘'
        : date.toLocaleDateString('ko-KR', { weekday: 'short', timeZone: 'Asia/Seoul' });
      const items = notices
        .filter((notice) => {
          const dday = getNoticeDday(notice);
          return dday === offset && notice.actionState !== 'done' && notice.actionState !== 'dismissed';
        })
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      return { offset, label, items };
    });
  }, [notices]);
  const bestScholarshipNotice = useMemo(
    () => filteredNotices
      .filter((notice) => isScholarshipNotice(notice) && notice.actionState !== 'dismissed')
      .filter((notice) => isActionableNotice(notice))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0) || (getNoticeDday(a) ?? 999) - (getNoticeDday(b) ?? 999))
      [0] ?? null,
    [filteredNotices],
  );
  const careerRadarNotices = useMemo(
    () => filteredNotices
      .filter((notice) => isEmploymentNotice(notice) && notice.actionState !== 'dismissed')
      .filter((notice) => isActionableNotice(notice))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0) || (getNoticeDday(a) ?? 999) - (getNoticeDday(b) ?? 999))
      .slice(0, 2),
    [filteredNotices],
  );
  const progressSnapshot = useMemo(() => {
    const actionable = notices.filter((notice) => notice.actionState !== 'dismissed');
    const done = actionable.filter((notice) => notice.actionState === 'done').length;
    const tracking = actionable.filter((notice) => notice.actionState === 'todo' || notice.actionState === 'in_progress').length;
    const percent = actionable.length > 0 ? Math.round((done / actionable.length) * 100) : 0;
    return {
      total: actionable.length,
      done,
      tracking,
      percent,
    };
  }, [notices]);

  useEffect(() => {
    if (!clientStateHydrated || !browserNotificationsEnabled) return;
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (webPushSubscribed) return;
    if (localStorage.getItem(NOTICE_BASELINE_KEY) !== '1') return;
    if (readNoticeSet.size === 0) return;

    let changed = false;
    const newSet = new Set(notifiedNewNoticeIdsRef.current);
    const urgentSet = new Set(notifiedUrgentNoticeIdsRef.current);

    for (const notice of notices) {
      if (notice.actionState === 'dismissed') continue;

      const shouldNotifyNew = !readNoticeSet.has(notice.id) && !newSet.has(notice.id);
      if (shouldNotifyNew) {
        newSet.add(notice.id);
        changed = true;
        const notification = new Notification('새 공지 도착', {
          body: notice.title,
          tag: `notice-new-${notice.id}`,
        });
        notification.onclick = () => {
          window.focus();
          window.open(notice.url, '_blank', 'noopener,noreferrer');
        };
      }

      const isUrgentDeadline =
        typeof notice.dday === 'number' &&
        notice.dday >= 0 &&
        notice.dday <= 3 &&
        notice.actionState !== 'done' &&
        !urgentSet.has(notice.id);
      if (isUrgentDeadline) {
        urgentSet.add(notice.id);
        changed = true;
        const subtitle = notice.dday === 0 ? '오늘 마감입니다.' : `마감 D-${notice.dday}입니다.`;
        const notification = new Notification('마감 임박 공지', {
          body: `${subtitle} ${notice.title}`,
          tag: `notice-urgent-${notice.id}`,
        });
        notification.onclick = () => {
          window.focus();
          window.open(notice.url, '_blank', 'noopener,noreferrer');
        };
      }
    }

    if (!changed) return;

    const compactedNew = clampStoredIds(newSet);
    const compactedUrgent = clampStoredIds(urgentSet);
    notifiedNewNoticeIdsRef.current = new Set(compactedNew);
    notifiedUrgentNoticeIdsRef.current = new Set(compactedUrgent);
    localStorage.setItem(NOTICE_NOTIFIED_NEW_IDS_KEY, JSON.stringify(compactedNew));
    localStorage.setItem(NOTICE_NOTIFIED_URGENT_IDS_KEY, JSON.stringify(compactedUrgent));
  }, [browserNotificationsEnabled, clientStateHydrated, notices, readNoticeSet, webPushSubscribed]);

  const markAllAsRead = useCallback(() => {
    const next = Array.from(new Set([...readNoticeIds, ...notices.map((notice) => notice.id)]));
    setReadNoticeIds(next);
    queueDashboardSync({ readNoticeIds: next });
  }, [notices, queueDashboardSync, readNoticeIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.dispatchEvent(new CustomEvent('myschoolmate:inbox-summary', {
      detail: {
        unreadNoticeCount,
        urgentInboxCount,
        easyToMissCount,
        items: navInboxItems.map((item) => ({
          id: item.id,
          noticeId: item.noticeId,
          type: item.type,
          title: item.title,
          subtitle: item.subtitle,
        })),
      },
    }));
  }, [easyToMissCount, navInboxItems, unreadNoticeCount, urgentInboxCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    return () => {
      window.dispatchEvent(new CustomEvent('myschoolmate:inbox-summary', {
        detail: {
          unreadNoticeCount: 0,
          urgentInboxCount: 0,
          easyToMissCount: 0,
          items: [],
        },
      }));
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const openNoticeFromNav = (event: Event) => {
      const noticeId = Number((event as CustomEvent<{ noticeId?: unknown }>).detail?.noticeId);
      if (!Number.isInteger(noticeId)) return;
      const target = noticeLookup.get(noticeId);
      if (target) handleOpenNotice(target);
    };

    window.addEventListener('myschoolmate:open-notice', openNoticeFromNav);
    window.addEventListener('myschoolmate:mark-all-read', markAllAsRead);
    return () => {
      window.removeEventListener('myschoolmate:open-notice', openNoticeFromNav);
      window.removeEventListener('myschoolmate:mark-all-read', markAllAsRead);
    };
  }, [handleOpenNotice, markAllAsRead, noticeLookup]);

  const autoCrawlerStatusText = toCrawlerStatusText(autoCrawlerStatus);

  return (
    <div className="min-h-screen font-sans bg-[url('/background.png')] bg-cover bg-center md:bg-fixed text-foreground overflow-x-hidden">
      <div data-theme-surface className="min-h-screen bg-background/60 backdrop-blur-[20px] p-4 md:p-8 pt-20 md:pt-28 transition-colors duration-300">
        <main className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-12">
          <CommandPalette
            notices={notices.map((notice) => ({ id: notice.id, title: notice.title, dday: notice.dday }))}
            onOpenNotice={(noticeId) => {
              const target = notices.find((notice) => notice.id === noticeId);
              if (target) {
                handleOpenNotice(target);
              }
            }}
            onRefresh={refreshNotices}
            onToggleFilters={() => setShowFilters((prev) => !prev)}
          />

          {/* Header */}
          <motion.header
            className="flex flex-col gap-6 mt-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">내 학교 생활 🎓</h1>
                </div>
                <p className="mt-1 text-xs text-muted-foreground/80 break-keep">
                  {autoCrawlerStatusText}
                </p>
                {refreshMessage && (
                  <p className="mt-1 text-xs font-semibold text-primary/90 break-keep" aria-live="polite">
                    {refreshMessage}
                  </p>
                )}
              </div>
              <div className="flex gap-2 self-end sm:self-auto shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsStyleDialogOpen(true)}
                  aria-label="대시보드 관리 열기"
                  className="rounded-full hover:bg-muted shadow-sm text-muted-foreground hover:scale-105 transition-transform"
                >
                  <Layout className="w-5 h-5" />
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-muted shadow-sm text-muted-foreground hover:scale-105 transition-transform"
                >
                  <Link href="/planning" aria-label="커리큘럼 페이지로 이동">
                    <MapIcon className="w-5 h-5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-muted shadow-sm text-muted-foreground hover:scale-105 transition-transform"
                >
                  <Link href="/settings" aria-label="설정 페이지로 이동">
                    <SettingsIcon className="w-5 h-5" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Dashboard Settings Dialog */}
            <Dialog open={isStyleDialogOpen} onOpenChange={setIsStyleDialogOpen}>
              <DialogContent className="max-w-[calc(100vw-1.5rem)] sm:max-w-md rounded-[24px] sm:rounded-[28px] p-4 sm:p-6 gap-6">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <Layout className="w-5 h-5" /> 대시보드 관리
                  </DialogTitle>
                  <DialogDescription>
                    대시보드에 표시할 위젯과 순서를 설정하세요.
                  </DialogDescription>
                </DialogHeader>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 py-2"
                >
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {widgetOrder.map((id, index) => (
                        <motion.div
                          key={id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50 group hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {(() => {
                              const widgetMeta = id === 'cafeteria'
                                ? { emoji: '🍱', label: '오늘의 학식' }
                                : { emoji: '📢', label: '공지사항' };
                              return (
                                <>
                                  <motion.div
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    className="p-2 bg-background rounded-lg shadow-sm"
                                  >
                                    {widgetMeta.emoji}
                                  </motion.div>
                                  <div>
                                    <span className="font-bold text-sm">{widgetMeta.label}</span>
                                    <p className="text-[10px] text-muted-foreground whitespace-normal">드래그하거나 버튼으로 이동 가능</p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-background rounded-xl p-1 shadow-sm border border-border/50">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-full hover:bg-muted"
                                disabled={index === 0}
                                onClick={() => moveWidget(id, 'up')}
                                aria-label={`${getWidgetLabel(id)} 위로 이동`}
                              >
                                <ChevronUp className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-full hover:bg-muted"
                                disabled={index === widgetOrder.length - 1}
                                onClick={() => moveWidget(id, 'down')}
                                aria-label={`${getWidgetLabel(id)} 아래로 이동`}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                            </div>

                            <motion.div whileTap={{ scale: 0.9 }}>
                              <Button
                                variant={enabledWidgets[id] ? "default" : "outline"}
                                size="icon"
                                className="w-10 h-10 rounded-full shadow-sm transition-all duration-300"
                                onClick={() => toggleWidget(id)}
                                aria-label={`${getWidgetLabel(id)} ${enabledWidgets[id] ? '숨기기' : '보이기'}`}
                                aria-pressed={enabledWidgets[id]}
                              >
                                {enabledWidgets[id] ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </Button>
                            </motion.div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  <p className="text-[11px] text-center text-muted-foreground pt-2">
                    * &apos;오늘의 브리핑&apos;은 항상 최상단에 고정됩니다.
                  </p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="pt-4"
                >
                  <Button
                    className="w-full h-12 rounded-xl font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all"
                    onClick={() => setIsStyleDialogOpen(false)}
                  >
                    설정 완료
                  </Button>
                </motion.div>
              </DialogContent>
            </Dialog>

            {/* AI Briefing Card */}
            <motion.div
              className="bg-card/80 backdrop-blur-md rounded-[20px] sm:rounded-[24px] p-4 sm:p-6 shadow-lg transition-all border border-border/50"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{
                y: -3,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
                borderColor: "rgba(49, 130, 246, 0.3)"
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-red-500 bg-clip-text text-transparent">오늘의 브리핑</h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBriefingTuningOpen((prev) => !prev)}
                  aria-expanded={isBriefingTuningOpen}
                  aria-controls="briefing-tuning-panel"
                  className="h-7 px-2.5 rounded-full text-[11px] whitespace-nowrap"
                >
                  <SlidersHorizontal className="w-3 h-3 mr-1" />
                  맞춤 설정하기
                  {briefingTuningActiveCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                      {briefingTuningActiveCount}
                    </span>
                  )}
                  <motion.span
                    animate={{ rotate: isBriefingTuningOpen ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="inline-flex items-center ml-0.5"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </motion.span>
                </Button>
              </div>

              <AnimatePresence initial={false}>
                {isBriefingTuningOpen && (
                  <motion.div
                    id="briefing-tuning-panel"
                    initial={{ opacity: 0, height: 0, y: -4 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -4 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-4 overflow-hidden rounded-[20px] border border-border/50 bg-background/50 p-3 sm:p-4"
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">브리핑 톤</label>
                          <select
                            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-muted-foreground"
                            value={briefingTone ?? ''}
                            onChange={(event) => setBriefingTone(normalizeBriefingTone(event.target.value))}
                          >
                            <option value="">기본 톤</option>
                            <option value="friendly">친근하게</option>
                            <option value="concise">간결하게</option>
                            <option value="formal">정중하게</option>
                            <option value="motivational">동기부여 중심</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-muted-foreground">브리핑 길이</label>
                          <select
                            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-xs font-semibold text-muted-foreground"
                            value={briefingLength ?? ''}
                            onChange={(event) => setBriefingLength(normalizeBriefingLength(event.target.value))}
                          >
                            <option value="">기본 길이</option>
                            <option value="short">짧게</option>
                            <option value="medium">보통</option>
                            <option value="long">길게</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">집중 카테고리</label>
                        <div className="flex flex-wrap gap-1.5">
                          {BRIEFING_FOCUS_CATEGORIES.map((category) => {
                            const selected = briefingFocusCategories.includes(category);
                            return (
                              <button
                                key={`briefing-focus-${category}`}
                                type="button"
                                onClick={() => toggleBriefingFocusCategory(category)}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${selected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-muted/50 text-muted-foreground border-border hover:text-foreground'}`}
                              >
                                {BRIEFING_FOCUS_LABEL[category]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          onClick={refreshBriefingWithTuning}
                          disabled={briefingLoading}
                          className="h-8 px-3 rounded-full text-xs font-semibold"
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                          튜닝 반영 재생성
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={resetBriefingTuning}
                          disabled={briefingLoading}
                          className="h-8 px-3 rounded-full text-xs"
                        >
                          기본값으로 초기화
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                {briefingLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-4 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                        <Sparkles className="w-6 h-6 text-primary animate-spin-slow" style={{ animationDuration: '3s' }} />
                      </div>
                      <div className="space-y-1">
                        <motion.span
                          className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          AI가 데이터를 분석하고 있습니다...
                        </motion.span>
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <motion.div
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-primary/40"
                              animate={{ scale: [1, 1.5, 1], backgroundColor: ["rgba(var(--primary), 0.4)", "rgba(var(--primary), 1)", "rgba(var(--primary), 0.4)"] }}
                              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2 mt-2">
                      <motion.div
                        className="h-4 bg-muted/50 rounded-md w-full overflow-hidden relative"
                        initial={{ opacity: 0.5 }}
                        animate={{ opacity: 1 }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                          animate={{ x: ['100%', '-100%'] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        />
                      </motion.div>
                      <motion.div
                        className="h-4 bg-muted/50 rounded-md w-3/4 overflow-hidden relative"
                        initial={{ opacity: 0.5 }}
                        animate={{ opacity: 1 }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                          animate={{ x: ['100%', '-100%'] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: 0.2 }}
                        />
                      </motion.div>
                      <motion.div
                        className="h-4 bg-muted/50 rounded-md w-1/2 overflow-hidden relative"
                        initial={{ opacity: 0.5 }}
                        animate={{ opacity: 1 }}
                      >
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent"
                          animate={{ x: ['100%', '-100%'] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', delay: 0.4 }}
                        />
                      </motion.div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="content"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10">
                      <div className="text-foreground leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={{
                            strong: (props) => <strong className="font-bold text-primary inline" {...props} />,
                            p: (props) => <p className="mb-4 last:mb-0 text-[15px] leading-7 text-foreground/90" {...props} />,
                            ul: (props) => <ul className="space-y-2 mb-4 list-disc pl-5" {...props} />,
                            li: (props) => <li className="text-[15px] leading-7 text-foreground/90" {...props} />,
                            a: (props) => {
                              const href = props.href as string | undefined;
                              return (
                                <a
                                  className="text-blue-600 dark:text-blue-400 font-bold hover:underline underline-offset-4 inline"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={href ? `외부 링크: ${href}` : '새 탭에서 열기'}
                                  {...props}
                                />
                              );
                            },
                            h1: (props) => <h3 className="text-xl font-bold text-foreground mb-3 mt-6" {...props} />,
                            h2: (props) => <h4 className="text-lg font-bold text-foreground mb-2 mt-4" {...props} />,
                            h3: (props) => <h5 className="text-base font-bold text-foreground mb-2 mt-3" {...props} />,
                          }}
                        >
                          {briefing || "오늘의 브리핑 데이터가 없습니다."}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

          </motion.header>

          <motion.section
            data-testid="student-command-center"
            className="space-y-4"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-primary">MySchoolMate 작전판</p>
                <h2 className="text-xl font-bold tracking-tight">지금 확인할 것만 먼저 정리했어요</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                마감, 장학, 취업, 진행률을 한 화면에서 훑어봅니다.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
              <div
                data-testid="today-action-plan"
                className="lg:col-span-3 rounded-[20px] border border-border/60 bg-card/75 backdrop-blur-md p-4 sm:p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Target className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold">오늘 할 일 3개</h3>
                      <p className="text-[11px] text-muted-foreground">추천점수와 마감 임박도를 합산했습니다.</p>
                    </div>
                  </div>
                </div>

                {priorityActionNotices.length === 0 ? (
                  <div className="rounded-2xl border border-border/50 bg-background/50 p-4 text-sm text-muted-foreground">
                    지금 바로 처리할 공지가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {priorityActionNotices.map(({ notice, dday }, index) => (
                      <div
                        key={`priority-action-${notice.id}`}
                        className="rounded-2xl border border-border/50 bg-background/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenNotice(notice)}
                            className="min-w-0 text-left"
                          >
                            <span className="mb-1 inline-flex items-center gap-1.5 text-[10px] font-bold text-primary">
                              #{index + 1} {getActionPriorityLabel(notice)}
                              {typeof dday === 'number' && dday >= 0 && (
                                <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-rose-600 dark:text-rose-400">
                                  {formatDdayLabel(dday)}
                                </span>
                              )}
                            </span>
                            <p className="line-clamp-2 text-sm font-semibold text-foreground">{notice.title}</p>
                          </button>
                          <Button
                            type="button"
                            variant={notice.actionState === 'todo' ? 'secondary' : 'outline'}
                            size="sm"
                            disabled={actionBusyNoticeId === notice.id}
                            onClick={() => setNoticeAction(notice.id, 'todo')}
                            className="h-8 rounded-full px-2.5 text-[11px]"
                          >
                            할 일
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                data-testid="deadline-radar"
                className="lg:col-span-3 rounded-[20px] border border-border/60 bg-card/75 backdrop-blur-md p-4 sm:p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <Flame className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold">7일 마감 레이더</h3>
                    <p className="text-[11px] text-muted-foreground">오늘부터 일주일 안에 닫히는 공지를 집계합니다.</p>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {deadlineRadarDays.map((day) => {
                    const heightClass = day.items.length >= 3 ? 'h-20' : day.items.length === 2 ? 'h-14' : day.items.length === 1 ? 'h-9' : 'h-4';
                    const topNotice = day.items[0];
                    return (
                      <button
                        key={`deadline-day-${day.offset}`}
                        type="button"
                        disabled={!topNotice}
                        onClick={() => topNotice && handleOpenNotice(topNotice)}
                        className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border border-border/40 bg-background/50 p-2 disabled:cursor-default"
                        aria-label={`${day.label} 마감 공지 ${day.items.length}개`}
                      >
                        <span className="text-[10px] font-bold text-muted-foreground">{day.label}</span>
                        <span className={`w-full rounded-full ${heightClass} bg-gradient-to-t ${day.items.length > 0 ? 'from-rose-500 to-orange-400' : 'from-muted to-muted/60'} transition-all`} />
                        <span className="text-[11px] font-bold text-foreground">{day.items.length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                data-testid="scholarship-fit-meter"
                className="lg:col-span-2 rounded-[20px] border border-border/60 bg-card/75 backdrop-blur-md p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300">
                    <Trophy className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold">장학 적합도</h3>
                </div>
                {bestScholarshipNotice ? (
                  <button
                    type="button"
                    onClick={() => handleOpenNotice(bestScholarshipNotice)}
                    className="w-full text-left"
                  >
                    <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500"
                        style={{ width: `${Math.min(100, Math.max(12, bestScholarshipNotice.relevanceScore ?? 35))}%` }}
                      />
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">{bestScholarshipNotice.title}</p>
                    <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                      추천점수 {bestScholarshipNotice.relevanceScore ?? 0} · {formatDdayLabel(getNoticeDday(bestScholarshipNotice))}
                    </p>
                  </button>
                ) : (
                  <p className="text-sm text-muted-foreground">현재 조건에 맞는 장학 공지가 없습니다.</p>
                )}
              </div>

              <div
                data-testid="career-opportunity-radar"
                className="lg:col-span-2 rounded-[20px] border border-border/60 bg-card/75 backdrop-blur-md p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <BriefcaseBusiness className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold">취업/인턴 레이더</h3>
                </div>
                {careerRadarNotices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">지금 뜬 취업/인턴 공지가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {careerRadarNotices.map((notice) => (
                      <button
                        key={`career-radar-${notice.id}`}
                        type="button"
                        onClick={() => handleOpenNotice(notice)}
                        className="w-full rounded-xl border border-border/50 bg-background/50 p-2.5 text-left hover:bg-muted/40"
                      >
                        <p className="line-clamp-2 text-xs font-semibold text-foreground">{notice.title}</p>
                        <p className="mt-1 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                          {typeof notice.dday === 'number' ? formatDdayLabel(notice.dday) : toCategoryLabel(notice.category)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div
                data-testid="progress-snapshot"
                className="lg:col-span-2 rounded-[20px] border border-border/60 bg-card/75 backdrop-blur-md p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <BarChart3 className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold">처리 진행률</h3>
                </div>
                <div className="mb-2 flex items-end justify-between">
                  <span className="text-3xl font-black tracking-tight">{progressSnapshot.percent}%</span>
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    완료 {progressSnapshot.done}/{progressSnapshot.total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary"
                    style={{ width: `${progressSnapshot.percent}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold">
                  <span className="rounded-xl bg-background/60 px-2 py-1.5 text-muted-foreground">추적 중 {progressSnapshot.tracking}</span>
                  <span className="rounded-xl bg-background/60 px-2 py-1.5 text-muted-foreground">미확인 {unreadNoticeCount}</span>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Reorderable Widgets */}
          <Reorder.Group axis="y" values={widgetOrder} onReorder={saveWidgetOrder} className="space-y-8">
            <AnimatePresence>
              {widgetOrder.filter(id => enabledWidgets[id]).map((widgetId) => (
                <Reorder.Item
                  key={widgetId}
                  value={widgetId}
                  className="relative group/widget"
                  layout="position"
                >
                  {/* Drag Handle - Hidden by default, show on hover */}
                  <div className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover/widget:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-2 hover:bg-muted rounded-lg hidden lg:block">
                    <GripVertical className="w-5 h-5 text-muted-foreground" />
                  </div>

                  {widgetId === 'inbox' ? (
                    <motion.section
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.15 }}
                    >
                      <Card className="p-6 rounded-[24px] border-border/50 bg-card/70 backdrop-blur-md shadow-sm">
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300">
                              <BellRing className="w-4 h-4" />
                            </div>
                            <div>
                              <h2 className="text-lg font-bold">알림함</h2>
                              <p className="text-xs text-muted-foreground">
                                새 공지와 마감 임박 공지를 보여줍니다.
                              </p>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={markAllAsRead}
                            disabled={unreadNoticeCount === 0}
                            className="rounded-full"
                          >
                            <CheckCheck className="w-4 h-4 mr-1.5" />
                            모두 읽음
                          </Button>
                        </div>

                        <div className="flex items-center gap-2 mb-4 text-xs">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                            새 공지 {unreadNoticeCount}개
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold">
                            <Clock3 className="w-3 h-3" />
                            마감 임박 {urgentInboxCount}개
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-300 font-semibold">
                            놓치기 쉬운 공지 {easyToMissCount}개
                          </span>
                        </div>

                        {inboxItems.length === 0 ? (
                          <div className="py-10 text-center text-muted-foreground text-sm">
                            새로운 알림이 없습니다.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {inboxItems.map((item) => {
                              const linkedNotice = noticeLookup.get(item.noticeId);
                              if (!linkedNotice) return null;

                              return (
                                <button
                                  key={item.id}
                                  className="w-full text-left p-3 rounded-xl border border-border/50 bg-background/60 hover:bg-muted/50 transition-colors"
                                  onClick={() => handleOpenNotice(linkedNotice)}
                                >
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.type === 'DEADLINE_SOON'
                                        ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
                                        : 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20'
                                        }`}
                                    >
                                      {item.type === 'DEADLINE_SOON' ? '마감 임박' : '새 공지'}
                                    </span>
                                    <span className="text-[11px] text-muted-foreground">{item.subtitle}</span>
                                  </div>
                                  <p className="text-sm font-semibold text-foreground line-clamp-1">{item.title}</p>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className="mt-5 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-bold text-muted-foreground">마감 타임라인 (D-14)</p>
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 rounded-full text-[11px]"
                                onClick={downloadDeadlineCalendarFeed}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                ICS
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 rounded-full text-[11px]"
                                onClick={() => void copyDeadlineCalendarFeedUrl()}
                              >
                                <Share2 className="w-3 h-3 mr-1" />
                                구독 링크
                              </Button>
                            </div>
                          </div>
                          {deadlineTimeline.length === 0 ? (
                            <div className="p-3 rounded-xl border border-border/50 bg-background/50 text-xs text-muted-foreground">
                              임박한 마감 공지가 없습니다.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {deadlineTimeline.slice(0, 5).map((notice) => (
                                <button
                                  key={`timeline-${notice.id}`}
                                  type="button"
                                  onClick={() => handleOpenNotice(notice)}
                                  className="w-full text-left p-2.5 rounded-xl border border-border/50 bg-background/60 hover:bg-muted/40 transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-foreground line-clamp-1">{notice.title}</p>
                                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 shrink-0">
                                      {formatDdayLabel(notice.dday)}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="mt-5 space-y-2">
                          <p className="text-xs font-bold text-muted-foreground">놓치기 쉬운 공지</p>
                          {easyToMissNotices.length === 0 ? (
                            <div className="p-3 rounded-xl border border-border/50 bg-background/50 text-xs text-muted-foreground">
                              현재 조건에서 탐지된 공지가 없습니다.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {easyToMissNotices.map((notice) => (
                                <button
                                  key={`easy-miss-${notice.id}`}
                                  type="button"
                                  onClick={() => handleOpenNotice(notice)}
                                  className="w-full text-left p-2.5 rounded-xl border border-border/50 bg-orange-500/[0.05] hover:bg-orange-500/[0.1] transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-foreground line-clamp-1">{notice.title}</p>
                                    <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300 shrink-0">
                                      {typeof notice.dday === 'number' ? formatDdayLabel(notice.dday) : '-'}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </Card>
                    </motion.section>
                  ) : widgetId === 'cafeteria' ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    >
                      <CafeteriaWidget />
                    </motion.div>
                  ) : (
                    <section className="space-y-4 relative min-h-[300px]">
                      {loading && <LoadingOverlay message="최신 공지사항을 불러오고 있어요..." />}

                      <div className="flex flex-col gap-5">
                        {/* Category Tabs & Search Bar */}
                        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                          <div className="w-full md:w-auto flex gap-1 p-1.5 bg-muted/60 dark:bg-muted/40 rounded-full border border-border/60 dark:border-border/40 backdrop-blur-sm shadow-sm overflow-x-auto md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {['ALL', 'Academic', 'Scholarship', 'General', 'Employment', 'News'].map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCategory(cat)}
                                aria-pressed={selectedCategory === cat}
                                className={`relative px-4 py-2 rounded-full text-sm font-bold transition-colors z-10 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${selectedCategory === cat ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                              >
                                {selectedCategory === cat && (
                                  <motion.span
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-primary rounded-full -z-10 shadow-md"
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                  />
                                )}
                                {cat === 'ALL' ? '전체' :
                                  cat === 'Academic' ? '학사' :
                                    cat === 'Scholarship' ? '장학' :
                                      cat === 'General' ? '일반' :
                                        cat === 'Employment' ? '취업' : '뉴스'}
                              </button>
                            ))}
                          </div>

                          <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              placeholder="공지 검색..."
                              aria-label="공지 검색"
                              className="pl-9 pr-4 h-10 rounded-full border-border bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery.trim().length > 0 && searchSuggestions.length > 0 && (
                              <div
                                data-testid="search-suggestion-list"
                                className="absolute z-30 mt-2 w-full rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg overflow-hidden"
                              >
                                {searchSuggestions.map((suggestion, index) => (
                                  <button
                                    key={`search-suggestion-${index}-${suggestion}`}
                                    data-testid="search-suggestion-item"
                                    type="button"
                                    className="w-full px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted/60 transition-colors"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => applySearchSuggestion(suggestion)}
                                  >
                                    {renderHighlightedText(suggestion, searchQuery)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl font-bold">공지사항</h2>
                            <div
                              className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-full border border-border/50 min-w-0"
                            >
                              <span className="text-xs text-muted-foreground font-medium break-keep">
                                {filteredNotices.length !== notices.length ? (
                                  <>
                                    전체 <span className="text-muted-foreground">{notices.length}</span>건 중
                                    <span className="ml-1 text-primary font-bold text-sm">
                                      {filteredNotices.length}건
                                    </span>
                                    {' '}필터링됨
                                  </>
                                ) : (
                                  <>
                                    총 <span className="font-bold text-foreground">{regularNotices.length}</span>건
                                  </>
                                )}
                              </span>
                            </div>
                            {pinnedNotices.length > 0 && (
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="button"
                                onClick={() => setIsPinnedExpanded(!isPinnedExpanded)}
                                aria-expanded={isPinnedExpanded}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${isPinnedExpanded ? 'bg-primary/12 border-primary/35 text-primary shadow-sm ring-1 ring-primary/20' : 'bg-background/85 border-foreground/15 text-foreground/90 hover:bg-background/100 hover:border-primary/30 hover:text-primary/90'}`}
                              >
                                <Sparkles className={`w-3.5 h-3.5 ${isPinnedExpanded ? 'text-primary' : 'text-foreground/80'}`} />
                                <span className="text-xs font-bold">고정 공지 {pinnedNotices.length}개</span>
                                <motion.span
                                  animate={{ rotate: isPinnedExpanded ? 180 : 0 }}
                                  className="flex items-center"
                                >
                                  <ArrowRight className="w-3 h-3 rotate-90" />
                                </motion.span>
                              </motion.button>
                            )}
                          </div>

                          <div className="flex gap-2 flex-wrap w-full md:w-auto md:justify-end">
                            <div className="flex gap-1 p-1.5 bg-muted/60 dark:bg-muted/40 rounded-full border border-border/60 dark:border-border/40 backdrop-blur-sm shadow-sm">
                              {([
                                { id: 'grid', label: '카드', Icon: LayoutGrid },
                                { id: 'list', label: '리스트', Icon: List },
                              ] as const).map(({ id, label, Icon }) => (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => setLayout(id)}
                                  aria-pressed={layout === id}
                                  className={`relative h-8 px-4 rounded-full text-sm font-bold transition-colors z-10 inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${layout === id ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                >
                                  {layout === id && (
                                    <motion.span
                                      layoutId="layoutModePill"
                                      className="absolute inset-0 bg-primary rounded-full -z-10 shadow-md"
                                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                  )}
                                  <Icon className="w-4 h-4" />
                                  {label}
                                </button>
                              ))}
                            </div>

                            <select
                              className="h-10 px-4 rounded-full border border-border/70 bg-background text-xs font-semibold text-muted-foreground"
                              value={sortMode}
                              onChange={(e) => setSortMode(e.target.value as 'latest' | 'relevance' | 'deadline')}
                            >
                              <option value="latest">최신순</option>
                              <option value="relevance">추천순</option>
                              <option value="deadline">마감순</option>
                            </select>

                            <select
                              className="h-10 px-4 rounded-full border border-border/70 bg-background text-xs font-semibold text-muted-foreground"
                              value={deadlineWithinDays === null ? '' : String(deadlineWithinDays)}
                              onChange={(e) => {
                                const next = e.target.value;
                                setDeadlineWithinDays(next ? Number(next) : null);
                              }}
                            >
                              <option value="">마감 전체</option>
                              <option value="3">D-3 이내</option>
                              <option value="7">D-7 이내</option>
                              <option value="14">D-14 이내</option>
                            </select>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setFavoriteOnly((prev) => !prev)}
                              aria-label="즐겨찾기 공지만 보기"
                              aria-pressed={favoriteOnly}
                              className={`h-10 px-4 rounded-full flex-1 sm:flex-none text-xs font-semibold ${favoriteOnly
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : 'text-muted-foreground border border-border'}`}
                            >
                              <Star className={`w-4 h-4 mr-1.5 ${favoriteOnly ? 'fill-current' : ''}`} />
                              즐겨찾기만
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setWatchlistOnly((prev) => !prev)}
                              aria-label="관심 공지만 보기"
                              aria-pressed={watchlistOnly}
                              className={`h-10 px-4 rounded-full flex-1 sm:flex-none text-xs font-semibold ${watchlistOnly
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                                : 'text-muted-foreground border border-border'}`}
                            >
                              <BookmarkPlus className="w-4 h-4 mr-1.5" />
                              워치리스트만
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowFilters(!showFilters)}
                              className={`text-sm h-10 px-4 rounded-full flex-1 sm:flex-none ${showFilters ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                            >
                              <SlidersHorizontal className="w-4 h-4 mr-1.5" /> 필터
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              onClick={refreshNotices}
                              disabled={loading}
                              className="h-10 px-4 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 flex-1 sm:flex-none"
                            >
                              {loading ? <ButtonLoader /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                              {loading ? '확인 중' : '새로고침'}
                            </Button>
                          </div>
                          {refreshMessage && (
                            <p className="text-xs font-medium text-muted-foreground md:text-right">
                              {refreshMessage}
                            </p>
                          )}
                        </div>
                      </div>

                      {showFilters && (
                        <div className="relative z-20 bg-card p-4 sm:p-5 rounded-[20px] shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 border border-border">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                            <h3 className="text-sm font-bold">상세 필터</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              {loadedProfile && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setFilterProfile({
                                    grade: loadedProfile.grade,
                                    income: loadedProfile.income,
                                    gpa: loadedProfile.gpa || 0
                                  })}
                                  className="text-xs h-7"
                                >
                                  내 정보 적용
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setFilterProfile({ grade: 0, income: 11, gpa: 0 });
                                  setFavoriteOnly(false);
                                  setWatchlistOnly(false);
                                  setActivePresetId(null);
                                }}
                                className="text-xs h-7 hover:bg-muted text-muted-foreground hover:text-foreground"
                              >
                                전체 보기
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                            <div className="space-y-2">
                              <label htmlFor="notice-preset-select" className="text-xs font-semibold text-muted-foreground">저장된 프리셋</label>
                              <select
                                id="notice-preset-select"
                                className="w-full bg-muted/50 p-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/50"
                                value={activePresetId === null ? '' : String(activePresetId)}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setActivePresetId(value ? Number(value) : null);
                                }}
                              >
                                <option value="">프리셋 미사용</option>
                                {presets.map((preset) => (
                                  <option key={`preset-${preset.id}`} value={preset.id}>
                                    {preset.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-muted-foreground">추천 미리보기</label>
                              <button
                                type="button"
                                onClick={() => setRecommendationPreviewEnabled((prev) => !prev)}
                                aria-pressed={recommendationPreviewEnabled}
                                className={`w-full h-[46px] rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${recommendationPreviewEnabled
                                  ? 'bg-primary/10 text-primary border-primary/40'
                                  : 'bg-muted/40 text-muted-foreground border-border'}`}
                              >
                                {recommendationPreviewEnabled ? '활성화됨' : '비활성화됨'}
                              </button>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-muted-foreground">프리셋 관리</label>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={savePreset}
                                  disabled={presetBusy}
                                  className="flex-1 h-[46px] rounded-xl"
                                >
                                  <BookmarkPlus className="w-4 h-4 mr-1.5" />
                                  저장
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={deletePreset}
                                  disabled={presetBusy || activePresetId === null}
                                  aria-label="선택한 프리셋 삭제"
                                  className="h-[46px] rounded-xl"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-muted-foreground">브라우저 알림</label>
                              <button
                                type="button"
                                onClick={() => void toggleBrowserNotifications()}
                                disabled={webPushBusy}
                                aria-pressed={browserNotificationsEnabled}
                                className={`w-full h-[46px] rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${browserNotificationsEnabled
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                                  : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'}`}
                              >
                                {webPushBusy
                                  ? '처리 중...'
                                  : webPushConfigured
                                    ? (webPushSubscribed ? '웹푸시 구독중' : '웹푸시 구독')
                                    : (browserNotificationsEnabled ? '알림 켜짐' : '알림 켜기')}
                              </button>
                              <p className="text-[11px] text-muted-foreground">
                                모드: {browserNotificationModeLabel} / 권한: {browserNotificationPermissionLabel}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-2">
                              <label htmlFor="notice-filter-grade" className="text-xs font-semibold text-muted-foreground">내 학년</label>
                              <select
                                id="notice-filter-grade"
                                className="w-full bg-muted/50 p-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/50"
                                value={filterProfile.grade}
                                onChange={(e) => setFilterProfile({ ...filterProfile, grade: Number(e.target.value) })}
                              >
                                <option value={0}>전체</option>
                                <option value={1}>1학년</option>
                                <option value={2}>2학년</option>
                                <option value={3}>3학년</option>
                                <option value={4}>4학년</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label htmlFor="notice-filter-income" className="text-xs font-semibold text-muted-foreground">내 소득분위</label>
                              <select
                                id="notice-filter-income"
                                className="w-full bg-muted/50 p-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/50"
                                value={filterProfile.income}
                                onChange={(e) => setFilterProfile({ ...filterProfile, income: Number(e.target.value) })}
                              >
                                <option value={11}>전체 보기 (필터 끄기)</option>
                                <option value={10}>10구간</option>
                                <option value={9}>9구간</option>
                                <option value={8}>8구간</option>
                                <option value={7}>7구간</option>
                                <option value={6}>6구간</option>
                                <option value={5}>5구간</option>
                                <option value={4}>4구간</option>
                                <option value={3}>3구간</option>
                                <option value={2}>2구간</option>
                                <option value={1}>1구간</option>
                                <option value={0}>기초/차상위</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label htmlFor="notice-filter-gpa" className="text-xs font-semibold text-muted-foreground">최소 학점</label>
                              <input
                                id="notice-filter-gpa"
                                type="number"
                                step="0.1"
                                className="w-full bg-muted/50 p-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/50"
                                value={filterProfile.gpa || ''}
                                onChange={(e) => setFilterProfile({ ...filterProfile, gpa: parseFloat(e.target.value) })}
                                placeholder="0.0"
                              />
                            </div>
                          </div>

                          {selectedTags.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-muted-foreground">선택된 태그</label>
                                <button
                                  type="button"
                                  onClick={() => setSelectedTags([])}
                                  className="text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
                                >
                                  태그 초기화
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {selectedTags.map((tag) => (
                                  <button
                                    key={`selected-tag-${tag}`}
                                    type="button"
                                    onClick={() =>
                                      setSelectedTags((prev) => prev.filter((item) => item !== tag))
                                    }
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                    aria-label={`선택된 태그 ${availableTagNameBySlug.get(tag) || tag} 제거`}
                                  >
                                    #{availableTagNameBySlug.get(tag) || tag}
                                    <X className="w-3 h-3" />
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>모드:</span>
                                <select
                                  className="bg-muted/50 rounded-full px-3 py-1 border border-border text-xs font-semibold"
                                  value={tagMode}
                                  onChange={(e) => setTagMode(e.target.value as 'any' | 'all')}
                                >
                                  <option value="any">하나라도 포함</option>
                                  <option value="all">모두 포함</option>
                                </select>
                              </div>
                            </div>
                          )}

                          {availableTags.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-muted-foreground">태그 필터</label>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {availableTags.map((tag) => {
                                  const isActive = selectedTags.includes(tag.slug);
                                  return (
                                    <button
                                      key={`tag-filter-${tag.slug}`}
                                      type="button"
                                      onClick={() =>
                                        setSelectedTags((prev) =>
                                          prev.includes(tag.slug)
                                            ? prev.filter((item) => item !== tag.slug)
                                            : [...prev, tag.slug]
                                        )
                                      }
                                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border hover:text-foreground'}`}
                                    >
                                      #{getNoticeTagLabel(tag)}
                                    </button>
                                  );
                                  })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {(selectedCategory === 'ALL' || selectedCategory === 'Scholarship') && scholarshipComparisonNotices.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.28 }}
                          data-testid="scholarship-compare-card"
                        >
                          <Card className="p-4 sm:p-5 rounded-[20px] border border-border/60 bg-card/70 backdrop-blur-sm">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div>
                                <h3 className="text-sm sm:text-base font-bold">장학금 비교 카드</h3>
                                <p className="text-[11px] text-muted-foreground">
                                  조건/마감/추천점수를 한 번에 비교합니다.
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              {scholarshipComparisonNotices.map((notice) => {
                                const conditions = [
                                  notice.minGrade ? `${notice.minGrade}학년↑` : null,
                                  notice.maxIncome !== null && notice.maxIncome !== undefined ? `소득 ${notice.maxIncome}구간↓` : null,
                                  notice.minGpa ? `GPA ${notice.minGpa}↑` : null,
                                ].filter(Boolean).join(' · ') || '별도 자격조건 확인 필요';

                                return (
                                  <button
                                    key={`scholarship-compare-${notice.id}`}
                                    type="button"
                                    onClick={() => handleOpenNotice(notice)}
                                    className="text-left p-3 rounded-xl border border-border/50 bg-background/60 hover:bg-muted/50 transition-colors"
                                  >
                                    <p className="text-xs font-bold text-foreground line-clamp-2 mb-2">{notice.title}</p>
                                    <p className="text-[11px] text-muted-foreground line-clamp-2">{conditions}</p>
                                    <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-semibold">
                                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                        점수 {notice.relevanceScore ?? 0}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                        {typeof notice.dday === 'number' ? formatDdayLabel(notice.dday) : '마감 미정'}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </Card>
                        </motion.div>
                      )}

                      <AnimatePresence mode='popLayout'>
                        {pinnedNotices.length > 0 && isPinnedExpanded && (
                          <motion.div
                            data-testid="pinned-notices-expanded"
                            key="pinned-notices"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden mb-2"
                          >
                          <div className={layout === 'grid' ? "relative z-0 grid gap-4 md:grid-cols-2" : "relative z-0 flex flex-col gap-3"}>
                              {pinnedNotices.map((notice, i) => (
                                <div key={notice.id} className="relative">
                                  <div className="absolute top-3 right-3 z-10">
                                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-bold border border-primary/20 backdrop-blur-sm">고정</span>
                                  </div>
                                  <NoticeCard
                                    key={notice.id}
                                    notice={notice}
                                    filterProfile={filterProfile}
                                    searchQuery={searchQuery}
                                    onOpen={handleOpenNotice}
                                    onToggleFavorite={toggleNoticeFavorite}
                                    favoriteSubmitting={favoriteBusyNoticeId === notice.id}
                                    index={i}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-6" />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <motion.div
                        layout
                        transition={{ layout: { type: 'spring', stiffness: 300, damping: 28 } }}
                        data-testid={`regular-notices-${layout}`}
                        className={layout === 'grid' ? "relative z-0 grid gap-4 md:grid-cols-2" : "relative z-0 flex flex-col gap-3"}
                      >
                        {regularNotices.slice(0, visibleCount).map((notice, i) => (
                          <NoticeCard
                            key={notice.id}
                            notice={notice}
                            filterProfile={filterProfile}
                            searchQuery={searchQuery}
                            onOpen={handleOpenNotice}
                            onToggleFavorite={toggleNoticeFavorite}
                            favoriteSubmitting={favoriteBusyNoticeId === notice.id}
                            index={i % 12}
                          />
                        ))}
                      </motion.div>

                      {/* Load More Button */}
                      {visibleCount < regularNotices.length && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex justify-center pt-8"
                        >
                          <Button
                            variant="ghost"
                            onClick={() => setVisibleCount(prev => prev + ITEMS_PER_PAGE)}
                            className="rounded-full px-12 py-8 h-auto border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-primary/30 group transition-all duration-300 shadow-sm"
                          >
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-sm font-bold flex items-center gap-2">
                                공지사항 더 보기
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                              </span>
                              <span className="text-[10px] text-muted-foreground font-medium">
                                {regularNotices.length - visibleCount}개의 공지가 더 있습니다
                              </span>
                            </div>
                          </Button>
                        </motion.div>
                      )}
                    </section>
                  )}
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>

          {/* Notice Detail Dialog */}
          <NoticeDialog
            notice={selectedNotice}
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            onActionChange={setNoticeAction}
            actionSubmitting={actionBusyNoticeId === selectedNotice?.id}
            onToggleFavorite={toggleNoticeFavorite}
            favoriteSubmitting={favoriteBusyNoticeId === selectedNotice?.id}
            onDownloadCalendar={downloadNoticeCalendar}
            onShareNotice={shareNotice}
          />

          <NoticeChatbot
            question={chatQuestion}
            loading={chatLoading}
            answer={chatAnswer}
            citations={chatCitations}
            suggestedKeywords={chatSuggestedKeywords}
            suggestions={noticeChatSuggestions}
            onQuestionChange={setChatQuestion}
            onAsk={askNoticeQuestion}
          />
        </main>
      </div>
    </div >
  );
}
