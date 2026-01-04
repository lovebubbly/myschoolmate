'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowRight, Calendar, Sparkles, SlidersHorizontal, Map, Settings as SettingsIcon, LayoutGrid, List } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { LoadingOverlay, ButtonLoader } from '@/components/LoadingOverlay';
import { CafeteriaWidget } from '@/components/CafeteriaWidget';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { GripVertical, Layout, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

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
  isPinned: boolean;
}

function NoticeCard({ notice, filterProfile, onOpen }: { notice: Notice, filterProfile: any, onOpen: (n: Notice) => void }) {
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
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <Card
        className="group relative overflow-hidden bg-card hover:bg-muted/50 border-border/60 hover:border-primary/20 shadow-sm hover:shadow-md transition-all duration-300 rounded-[24px] cursor-pointer h-full min-h-[220px]"
        onClick={() => onOpen(notice)}
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
            </div>
            <span className="text-xs text-muted-foreground/60 font-medium shrink-0 tracking-tight">{notice.date}</span>
          </div>

          <h3 className="font-bold text-[17px] leading-snug text-foreground/90 group-hover:text-primary transition-colors tracking-tight">
            {notice.title}
          </h3>

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
                {notice.summary}
              </span>
            </div>
          )}

          {/* Bottom Tags - Unified Minimal Style */}
          <div className="mt-auto pt-3 flex flex-wrap gap-2">
            {notice.deadline && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/[0.05] px-2.5 py-1 rounded-lg border border-rose-200/50 dark:border-rose-900/30">
                <Calendar className="w-3 h-3 opacity-70" />
                <span>~{notice.deadline}</span>
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
    </motion.div>
  );
}

function NoticeDialog({ notice, isOpen, onClose }: { notice: Notice | null, isOpen: boolean, onClose: () => void }) {
  if (!notice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] p-0 border-none bg-card/95 backdrop-blur-xl shadow-2xl">
        <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-md p-6 border-b border-border/50 flex justify-between items-start">
          <div className="space-y-1 pr-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase">
                {notice.category}
              </span>
              <span className="text-xs text-muted-foreground font-medium">{notice.date}</span>
            </div>
            <DialogTitle className="text-xl font-extrabold leading-tight text-foreground">
              {notice.title}
            </DialogTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted -mt-1 -mr-1">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 pt-2 space-y-6">
          {notice.summary && (
            <div className="bg-primary/5 rounded-2xl p-5 border border-primary/10">
              <h4 className="text-sm font-bold text-primary mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-red-500 bg-clip-text text-transparent">
                  AI 요약
                </span>
              </h4>
              <p className="text-[15px] leading-relaxed text-foreground/90">
                {notice.summary}
              </p>
            </div>
          )}

          <div className="text-foreground/80 leading-8 text-[15px] prose dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkBreaks]}
              components={{
                strong: ({ node, ...props }) => <span className="font-bold text-primary" {...props} />,
                p: ({ node, ...props }) => <p className="mb-4 last:mb-0" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc ml-5 space-y-2 my-4" {...props} />,
                li: ({ node, ...props }) => <li {...props} />,
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-6 rounded-2xl border border-border shadow-sm bg-card/50">
                    <table className="min-w-full divide-y divide-border text-[13px]" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => <thead className="bg-muted/50 border-b border-border" {...props} />,
                th: ({ node, ...props }) => <th className="px-4 py-3 text-left font-bold text-foreground border-r border-border/50 last:border-r-0 whitespace-nowrap bg-muted/10" {...props} />,
                td: ({ node, ...props }) => <td className="px-4 py-3 border-t border-border text-muted-foreground border-r border-border/50 last:border-r-0 min-w-[140px] break-keep leading-normal align-top" {...props} />,
                a: ({ node, ...props }) => <a className="text-primary font-bold hover:underline underline-offset-4 break-all" {...props} target="_blank" />,
                h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-4 mt-8 text-foreground" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-xl font-bold mb-3 mt-6 text-foreground border-b border-border pb-2" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-lg font-bold mb-2 mt-4 text-foreground" {...props} />,
              }}
            >
              {notice.content || "본문 내용이 없습니다. 원문을 확인해주세요."}
            </ReactMarkdown>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8 pb-4">
            <Button variant="outline" className="h-12 rounded-xl font-bold" onClick={() => window.open(notice.url, '_blank')}>
              원문 보러가기 <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button className="h-12 rounded-xl font-bold bg-primary text-primary-foreground" onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState<string>('');
  const [briefingLoading, setBriefingLoading] = useState(false);

  // Layout & Search State
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog State
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [filterProfile, setFilterProfile] = useState<{ grade: number; income: number; gpa: number }>({ grade: 0, income: 11, gpa: 0 }); // Default income 11 (All)
  const [loadedProfile, setLoadedProfile] = useState<any>(null);

  const [isPinnedExpanded, setIsPinnedExpanded] = useState(false);

  // Pagination
  const ITEMS_PER_PAGE = 12;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Widget Reordering State
  const [widgetOrder, setWidgetOrder] = useState<string[]>(['cafeteria', 'notices']);
  const [enabledWidgets, setEnabledWidgets] = useState<Record<string, boolean>>({
    cafeteria: true,
    notices: true
  });
  const [isStyleDialogOpen, setIsStyleDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
    // Load widget order from localStorage
    const savedOrder = localStorage.getItem('dashboard-widget-order');
    if (savedOrder) {
      try {
        setWidgetOrder(JSON.parse(savedOrder));
      } catch (e) {
        console.error('Failed to parse widget order', e);
      }
    }

    // Load enabled widgets from localStorage
    const savedEnabled = localStorage.getItem('dashboard-enabled-widgets');
    if (savedEnabled) {
      try {
        setEnabledWidgets(JSON.parse(savedEnabled));
      } catch (e) {
        console.error('Failed to parse enabled widgets', e);
      }
    }
  }, []);

  const saveWidgetOrder = (newOrder: string[]) => {
    setWidgetOrder(newOrder);
    localStorage.setItem('dashboard-widget-order', JSON.stringify(newOrder));
  };

  const toggleWidget = (id: string) => {
    const newEnabled = { ...enabledWidgets, [id]: !enabledWidgets[id] };
    setEnabledWidgets(newEnabled);
    localStorage.setItem('dashboard-enabled-widgets', JSON.stringify(newEnabled));
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
  }, [selectedCategory, searchQuery, filterProfile]);

  const loadData = async () => {
    await fetchProfile();
    await loadNotices();
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/profile', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.profile) {
        setLoadedProfile(data.profile);
        // Auto-apply filters as requested
        setFilterProfile({
          grade: data.profile.grade,
          income: data.profile.income,
          gpa: data.profile.gpa || 0
        });
        fetchBriefing();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBriefing = async () => {
    setBriefingLoading(true);
    try {
      const res = await fetch('/api/briefing');
      const data = await res.json();
      if (data.success) {
        setBriefing(data.briefing);
      }
    } catch (e) {
      console.error(e);
    }
    setBriefingLoading(false);
  };

  const loadNotices = async () => {
    try {
      const res = await fetch('/api/notices');
      const data = await res.json();
      if (data.success) {
        setNotices(data.notices);
      }
    } catch (error) {
      console.error('Failed to load notices:', error);
    }
  };

  const refreshNotices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notices/crawl', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setNotices(data.notices);
        fetchBriefing();
      }
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
    setLoading(false);
  };

  const handleOpenNotice = (notice: Notice) => {
    setSelectedNotice(notice);
    setIsDialogOpen(true);
  };

  // Filter & Search Logic
  const filteredNotices = notices
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .filter(n => {
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

  const pinnedNotices = filteredNotices.filter(n => n.isPinned);
  const regularNotices = filteredNotices.filter(n => !n.isPinned);

  return (
    <div className="min-h-screen font-sans bg-[url('/background.png')] bg-cover bg-center bg-fixed text-foreground">
      <div className="min-h-screen bg-background/60 backdrop-blur-[20px] p-4 md:p-8 transition-colors duration-500" style={{ paddingTop: '120px' }}>
        <main className="max-w-4xl mx-auto space-y-8 pb-12">

          {/* Header */}
          <motion.header
            className="flex flex-col gap-6 mt-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">내 학교 생활 🎓</h1>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsStyleDialogOpen(true)}
                  className="rounded-full hover:bg-muted shadow-sm text-muted-foreground hover:scale-105 transition-transform"
                >
                  <Layout className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => window.location.href = '/planning'} className="rounded-full hover:bg-muted shadow-sm text-muted-foreground hover:scale-105 transition-transform">
                  <Map className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => window.location.href = '/settings'} className="rounded-full hover:bg-muted shadow-sm text-muted-foreground hover:scale-105 transition-transform">
                  <SettingsIcon className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Dashboard Settings Dialog */}
            <Dialog open={isStyleDialogOpen} onOpenChange={setIsStyleDialogOpen}>
              <DialogContent className="max-w-md rounded-[28px] p-6 gap-6">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <Layout className="w-5 h-5" /> 대시보드 관리
                  </DialogTitle>
                </DialogHeader>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 py-2"
                >
                  <p className="text-sm text-muted-foreground mb-4">대시보드에 표시할 위젯과 순서를 설정하세요.</p>

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
                            <motion.div
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              className="p-2 bg-background rounded-lg shadow-sm"
                            >
                              {id === 'cafeteria' ? '🍱' : '📢'}
                            </motion.div>
                            <div>
                              <span className="font-bold text-sm">{id === 'cafeteria' ? '오늘의 학식' : '공지사항'}</span>
                              <p className="text-[10px] text-muted-foreground text-nowrap">드래그하거나 버튼으로 이동 가능</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center bg-background rounded-xl p-1 shadow-sm border border-border/50">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-lg hover:bg-muted"
                                disabled={index === 0}
                                onClick={() => moveWidget(id, 'up')}
                              >
                                <ChevronUp className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 rounded-lg hover:bg-muted"
                                disabled={index === widgetOrder.length - 1}
                                onClick={() => moveWidget(id, 'down')}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </Button>
                            </div>

                            <motion.div whileTap={{ scale: 0.9 }}>
                              <Button
                                variant={enabledWidgets[id] ? "default" : "outline"}
                                size="icon"
                                className="w-10 h-10 rounded-xl shadow-sm transition-all duration-300"
                                onClick={() => toggleWidget(id)}
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
                    * '오늘의 브리핑'은 항상 최상단에 고정됩니다.
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
              className="bg-card/80 backdrop-blur-md rounded-[24px] p-6 shadow-lg transition-all hover:shadow-xl border border-border/50 hover:border-primary/20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ scale: 1.005 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-red-500 bg-clip-text text-transparent">오늘의 브리핑</h2>
              </div>

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
                            strong: ({ node, ...props }) => <span className="font-bold text-primary" {...props} />,
                            p: ({ node, ...props }) => <p className="mb-4 last:mb-0 text-[16px] leading-8 text-foreground/90 break-keep" {...props} />,
                            ul: ({ node, ...props }) => <ul className="space-y-2 mb-4" {...props} />,
                            li: ({ node, ...props }) => <li className="flex gap-2 text-[16px] leading-8 text-foreground/90 break-keep" {...props} />,
                            a: ({ node, ...props }) => <a className="text-blue-600 dark:text-blue-400 font-bold hover:underline underline-offset-4" {...props} target="_blank" rel="noopener noreferrer" />,
                            h1: ({ node, ...props }) => <h3 className="text-xl font-bold text-foreground mb-3 mt-6" {...props} />,
                            h2: ({ node, ...props }) => <h4 className="text-lg font-bold text-foreground mb-2 mt-4" {...props} />,
                            h3: ({ node, ...props }) => <h5 className="text-base font-bold text-foreground mb-2 mt-3" {...props} />,
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

                  {widgetId === 'cafeteria' ? (
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
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                          <div className="flex flex-wrap gap-1 p-1 bg-muted/30 rounded-full border border-border/40 backdrop-blur-sm">
                            {['ALL', 'Academic', 'Scholarship', 'General', 'Employment', 'News'].map((cat) => (
                              <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`relative px-4 py-2 rounded-full text-sm font-bold transition-colors z-10 ${selectedCategory === cat ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
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
                              className="pl-9 pr-4 h-10 rounded-full border-border bg-background focus:ring-2 focus:ring-primary/20 transition-all"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold">공지사항</h2>
                            <div
                              className="flex items-center gap-1.5 bg-muted/50 px-3 py-1.5 rounded-xl border border-border/50"
                            >
                              <span className="text-xs text-muted-foreground font-medium">
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
                                onClick={() => setIsPinnedExpanded(!isPinnedExpanded)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-300 ${isPinnedExpanded ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/50 border-border/50 text-muted-foreground'}`}
                              >
                                <Sparkles className={`w-3.5 h-3.5 ${isPinnedExpanded ? 'text-primary' : 'text-muted-foreground'}`} />
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

                          <div className="flex gap-2 flex-wrap">
                            <div className="bg-muted p-1 rounded-full flex gap-1 border border-border">
                              <Button
                                variant={layout === 'grid' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setLayout('grid')}
                                className="rounded-full h-8 px-4"
                              >
                                <LayoutGrid className="w-4 h-4 mr-1.5" />
                                카드
                              </Button>
                              <Button
                                variant={layout === 'list' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setLayout('list')}
                                className="rounded-full h-8 px-4"
                              >
                                <List className="w-4 h-4 mr-1.5" />
                                리스트
                              </Button>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowFilters(!showFilters)}
                              className={`text-sm h-10 px-4 rounded-xl ${showFilters ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                            >
                              <SlidersHorizontal className="w-4 h-4 mr-1.5" /> 필터
                            </Button>

                            <Button
                              size="sm"
                              onClick={refreshNotices}
                              disabled={loading}
                              className="h-10 px-4 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                            >
                              {loading ? <ButtonLoader /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
                              {loading ? '검색 중' : '새로고침'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {showFilters && (
                        <div className="bg-card p-5 rounded-[20px] shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 border border-border">
                          <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold">상세 필터</h3>
                            <div className="flex items-center gap-2">
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
                                onClick={() => setFilterProfile({ grade: 0, income: 11, gpa: 0 })}
                                className="text-xs h-7 hover:bg-muted text-muted-foreground hover:text-foreground"
                              >
                                전체 보기
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-muted-foreground">내 학년</label>
                              <select
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
                              <label className="text-xs font-semibold text-muted-foreground">내 소득분위</label>
                              <select
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
                              <label className="text-xs font-semibold text-muted-foreground">최소 학점</label>
                              <input
                                type="number"
                                step="0.1"
                                className="w-full bg-muted/50 p-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/50"
                                value={filterProfile.gpa || ''}
                                onChange={(e) => setFilterProfile({ ...filterProfile, gpa: parseFloat(e.target.value) })}
                                placeholder="0.0"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <AnimatePresence mode='popLayout'>
                        {pinnedNotices.length > 0 && isPinnedExpanded && (
                          <motion.div
                            key="pinned-notices"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden mb-2"
                          >
                            <div className={`grid gap-4 ${layout === 'grid' ? "md:grid-cols-2" : "flex flex-col"}`}>
                              {pinnedNotices.map((notice) => (
                                <div key={notice.id} className="relative">
                                  <div className="absolute top-3 right-3 z-10">
                                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-bold border border-primary/20 backdrop-blur-sm">고정</span>
                                  </div>
                                  <NoticeCard notice={notice} filterProfile={filterProfile} onOpen={handleOpenNotice} />
                                </div>
                              ))}
                            </div>
                            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent my-6" />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div
                        className={layout === 'grid' ? "grid gap-4 md:grid-cols-2" : "flex flex-col gap-3"}
                      >
                        <AnimatePresence mode='popLayout'>
                          {regularNotices.slice(0, visibleCount).map((notice) => (
                            <NoticeCard key={notice.id} notice={notice} filterProfile={filterProfile} onOpen={handleOpenNotice} />
                          ))}
                        </AnimatePresence>
                      </div>

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
          <NoticeDialog notice={selectedNotice} isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
        </main>
      </div>
    </div >
  );
}
