'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowRight, Calendar, Sparkles, SlidersHorizontal, Map, Settings as SettingsIcon, LayoutGrid, List } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { LoadingOverlay, ButtonLoader } from '@/components/LoadingOverlay';
import { motion } from 'framer-motion';

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
}

function NoticeCard({ notice, filterProfile, onOpen }: { notice: Notice, filterProfile: any, onOpen: (n: Notice) => void }) {
  return (
    <Card className="group overflow-hidden bg-card/80 backdrop-blur-sm border-border hover:border-primary/30 shadow-sm hover:shadow-lg transition-all rounded-[20px] cursor-pointer" onClick={() => onOpen(notice)}>
      <div className="p-5 flex flex-col gap-3 h-full">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 rounded bg-muted text-muted-foreground text-[10px] font-bold uppercase transition-colors group-hover:bg-muted/80">
              {(() => {
                const cat = notice.category;
                if (cat === 'Academic') return '학사';
                if (cat === 'Scholarship') return '장학';
                if (cat === 'Employment') return '취업';
                if (cat === 'General') return '일반';
                if (cat === 'Event') return '행사';
                if (cat === 'Tuition') return '등록금';
                if (cat === 'News') return '소식';
                if (cat === 'Program') return '비교과';
                if (cat.includes('Academic')) return '학사';
                if (cat.includes('Scholarship')) return '장학';
                if (cat.includes('Employment')) return '취업';
                return cat;
              })()}
            </span>

            {notice.scholarshipType && notice.scholarshipType !== 'Other' && (
              <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] font-bold">
                {notice.scholarshipType}
              </span>
            )}
            {filterProfile.grade > 0 && notice.minGrade && filterProfile.grade >= notice.minGrade && (
              <span className="px-2 py-1 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-[10px] font-bold border border-green-200 dark:border-green-800">
                ✅ 학년 매칭
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground font-medium shrink-0">{notice.date}</span>
        </div>

        <h3 className="font-bold text-[17px] leading-snug text-foreground group-hover:text-primary transition-colors">
          {notice.title}
        </h3>

        {/* Summary */}
        {notice.summary && (
          <div className="text-sm text-muted-foreground leading-relaxed bg-muted/40 p-4 rounded-xl border border-border/60">
            <span className="font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-red-500 bg-clip-text text-transparent mr-1.5">
              AI 요약
            </span>
            {notice.summary}
          </div>
        )}

        <div className="mt-auto pt-2 flex flex-wrap gap-2">
          {notice.deadline && (
            <span className="flex items-center gap-1 text-xs font-bold text-red-800 bg-red-200 dark:bg-red-900/40 dark:text-red-200 px-2 py-1 rounded">
              <Calendar className="w-3 h-3" /> ~{notice.deadline}
            </span>
          )}
          {notice.minGrade && (
            <span className="text-[11px] font-bold text-orange-800 bg-orange-200 dark:bg-orange-900/40 dark:text-orange-200 px-2 py-1 rounded">
              최소 {notice.minGrade}학년
            </span>
          )}
          {notice.maxIncome !== null && (
            <span className="text-[11px] font-bold text-green-800 bg-green-200 dark:bg-green-900/40 dark:text-green-200 px-2 py-1 rounded">
              소득 {notice.maxIncome}구간↓
            </span>
          )}
          {notice.minGpa && (
            <span className="text-[11px] font-bold text-purple-800 bg-purple-200 dark:bg-purple-900/40 dark:text-purple-200 px-2 py-1 rounded">
              학점 {notice.minGpa}↑
            </span>
          )}
        </div>
      </div>
    </Card>
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
                <Sparkles className="w-4 h-4" /> AI 요약 브리핑
              </h4>
              <p className="text-[15px] leading-relaxed text-foreground/90">
                {notice.summary}
              </p>
            </div>
          )}

          <div className="text-foreground/80 leading-8 text-[15px] prose dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                strong: ({ node, ...props }) => <span className="font-bold text-primary" {...props} />,
                p: ({ node, ...props }) => <p className="mb-4 last:mb-0" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc ml-5 space-y-2 my-4" {...props} />,
                li: ({ node, ...props }) => <li {...props} />,
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-6 rounded-2xl border border-border shadow-sm">
                    <table className="min-w-full divide-y divide-border text-sm" {...props} />
                  </div>
                ),
                thead: ({ node, ...props }) => <thead className="bg-muted/50" {...props} />,
                th: ({ node, ...props }) => <th className="px-4 py-3 text-left font-bold text-foreground" {...props} />,
                td: ({ node, ...props }) => <td className="px-4 py-3 border-t border-border text-muted-foreground" {...props} />,
                a: ({ node, ...props }) => <a className="text-primary font-bold hover:underline underline-offset-4 break-all" {...props} target="_blank" />,
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

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterProfile, setFilterProfile] = useState<{ grade: number; income: number; gpa: number }>({ grade: 0, income: 10, gpa: 0 });
  const [loadedProfile, setLoadedProfile] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await fetchProfile();
    await loadNotices();
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/profile');
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
      if (n.maxIncome !== null && n.maxIncome !== undefined && filterProfile.income !== 10) {
        if (filterProfile.income > n.maxIncome) return false;
      }
      if (filterProfile.gpa && n.minGpa && filterProfile.gpa < n.minGpa) return false;

      return true;
    });

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
                <Button variant="ghost" size="icon" onClick={() => window.location.href = '/planning'} className="rounded-full hover:bg-muted shadow-sm text-muted-foreground hover:scale-105 transition-transform">
                  <Map className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => window.location.href = '/settings'} className="rounded-full hover:bg-muted shadow-sm text-muted-foreground hover:scale-105 transition-transform">
                  <SettingsIcon className="w-5 h-5" />
                </Button>
              </div>
            </div>

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

              {briefingLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </div>
              ) : briefing ? (
                <div className="text-foreground leading-relaxed">
                  <ReactMarkdown
                    components={{
                      strong: ({ node, ...props }) => <span className="font-bold text-primary" {...props} />,
                      p: ({ node, ...props }) => <p className="mb-4 last:mb-0 text-[16px] leading-8 text-foreground/90 break-keep" {...props} />,
                      ul: ({ node, ...props }) => <ul className="space-y-2 mb-4" {...props} />,
                      li: ({ node, ...props }) => <li className="flex gap-2 text-[16px] leading-8 text-foreground/90 break-keep" {...props} />,
                      h1: ({ node, ...props }) => <h3 className="text-xl font-bold text-foreground mb-3 mt-6" {...props} />,
                      h2: ({ node, ...props }) => <h4 className="text-lg font-bold text-foreground mb-2 mt-4" {...props} />,
                      h3: ({ node, ...props }) => <h5 className="text-base font-bold text-foreground mb-2 mt-3" {...props} />,
                    }}
                  >
                    {briefing}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground">데이터를 분석 중입니다...</p>
              )}
            </motion.div>
          </motion.header>

          {/* Notices Section */}
          <section className="space-y-4 relative min-h-[300px]">
            {loading && <LoadingOverlay message="최신 공지사항을 불러오고 있어요..." />}

            <div className="flex flex-col gap-5">
              {/* Category Tabs & Search Bar */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {['ALL', 'Academic', 'Scholarship', 'General', 'Employment', 'News'].map((cat) => (
                    <Button
                      key={cat}
                      variant={selectedCategory === cat ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory(cat)}
                      className={`rounded-full px-4 ${selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                    >
                      {cat === 'ALL' ? '전체' :
                        cat === 'Academic' ? '학사' :
                          cat === 'Scholarship' ? '장학' :
                            cat === 'General' ? '일반' :
                              cat === 'Employment' ? '취업' : '뉴스'}
                    </Button>
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
                  <span className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-md font-medium">{filteredNotices.length}건</span>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <div className="bg-muted p-1 rounded-xl flex gap-1 border border-border">
                    <Button
                      variant={layout === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setLayout('grid')}
                      className="rounded-lg h-8 px-3"
                    >
                      <LayoutGrid className="w-4 h-4 mr-1.5" />
                      카드
                    </Button>
                    <Button
                      variant={layout === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setLayout('list')}
                      className="rounded-lg h-8 px-3"
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
                    <label className="text-xs font-semibold text-muted-foreground">소득분위 (이하)</label>
                    <select
                      className="w-full bg-muted/50 p-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 border border-transparent focus:border-primary/50"
                      value={filterProfile.income}
                      onChange={(e) => setFilterProfile({ ...filterProfile, income: Number(e.target.value) })}
                    >
                      <option value={10}>전체 (제한없음)</option>
                      <option value={8}>8구간</option>
                      <option value={6}>6구간</option>
                      <option value={3}>3구간</option>
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

            <div className={layout === 'grid' ? "grid gap-4 md:grid-cols-2" : "flex flex-col gap-3"}>
              {filteredNotices.map((notice, idx) => (
                <NoticeCard key={idx} notice={notice} filterProfile={filterProfile} onOpen={handleOpenNotice} />
              ))}
            </div>
          </section>

          {/* Notice Detail Dialog */}
          <NoticeDialog notice={selectedNotice} isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
        </main>
      </div>
    </div>
  );
}
