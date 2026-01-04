'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowRight, Calendar, Sparkles, SlidersHorizontal, Map, Settings as SettingsIcon, LayoutGrid, List } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { LoadingOverlay, ButtonLoader } from '@/components/LoadingOverlay';

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
}

export default function Home() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState<string>('');
  const [briefingLoading, setBriefingLoading] = useState(false);

  // Layout State
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

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

  // Filter Logic
  // 1. Sort by Date Descending
  const sortedNotices = [...notices].sort((a, b) => {
    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return 0;
  });

  const filteredNotices = sortedNotices.filter(n => {
    // 2. Category Filter
    if (selectedCategory !== 'ALL') {
      if (selectedCategory === 'Academic' && !n.category.includes('학사')) return false;
      if (selectedCategory === 'Scholarship' && !n.category.includes('장학')) return false;
      if (selectedCategory === 'General' && !n.category.includes('일반')) return false;
      if (selectedCategory === 'Employment' && !n.category.includes('취업')) return false;
    }

    // 3. Grade Filter
    if (n.minGrade && filterProfile.grade > 0 && filterProfile.grade < n.minGrade) return false;

    // 4. Income Filter
    if (n.maxIncome !== null && n.maxIncome !== undefined && filterProfile.income !== 10) {
      if (filterProfile.income > n.maxIncome) return false;
    }

    // 5. GPA Filter
    if (filterProfile.gpa && n.minGpa) {
      if (filterProfile.gpa < n.minGpa) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen font-sans bg-[url('/background.png')] bg-cover bg-center bg-fixed text-foreground">
      <div className="min-h-screen bg-background/60 backdrop-blur-[20px] p-4 md:p-8 transition-colors duration-500">
        <main className="max-w-4xl mx-auto space-y-8">

          {/* Header */}
          <header className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-extrabold tracking-tight">내 학교 생활 🎓</h1>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => window.location.href = '/planning'} className="rounded-full hover:bg-muted shadow-sm text-muted-foreground">
                  <Map className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => window.location.href = '/settings'} className="rounded-full hover:bg-muted shadow-sm text-muted-foreground">
                  <SettingsIcon className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* AI Briefing Card */}
            <div className="bg-card/80 backdrop-blur-md rounded-[24px] p-6 shadow-sm transition-all hover:shadow-md border border-border">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-primary/10 p-2 rounded-full">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">오늘의 브리핑</h2>
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
                      p: ({ node, ...props }) => <p className="mb-4 last:mb-0 text-[15px] leading-7 text-muted-foreground" {...props} />,
                      ul: ({ node, ...props }) => <ul className="space-y-2 mb-4" {...props} />,
                      li: ({ node, ...props }) => <li className="flex gap-2 text-[15px] leading-7 text-muted-foreground" {...props} />,
                      h1: ({ node, ...props }) => <h3 className="text-lg font-bold text-foreground mb-2 mt-4" {...props} />,
                      h2: ({ node, ...props }) => <h4 className="text-base font-bold text-foreground mb-2 mt-4" {...props} />,
                      h3: ({ node, ...props }) => <h5 className="text-sm font-bold text-foreground mb-1 mt-2" {...props} />,
                    }}
                  >
                    {briefing}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground">데이터를 분석 중입니다...</p>
              )}
            </div>
          </header>

          {/* Notices Section */}
          <section className="space-y-4 relative min-h-[300px]">
            {loading && <LoadingOverlay message="최신 공지사항을 불러오고 있어요..." />}

            <div className="flex flex-col gap-4">
              {/* Category Tabs */}
              <div className="flex flex-wrap gap-2">
                {['ALL', 'Academic', 'Scholarship', 'General', 'Employment'].map((cat) => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                    className={`rounded-full px-4 ${selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                  >
                    {cat === 'ALL' ? '전체' :
                      cat === 'Academic' ? '학사' :
                        cat === 'General' ? '일반' :
                          cat === 'Scholarship' ? '장학' : '취업'}
                  </Button>
                ))}
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
                <Card key={idx} className="group overflow-hidden bg-card/80 backdrop-blur-sm border-border hover:border-primary/30 shadow-sm hover:shadow-lg transition-all rounded-[20px] cursor-pointer" onClick={() => window.open(notice.url, '_blank')}>
                  <div className="p-5 flex flex-col gap-3 h-full">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-1 rounded bg-muted text-muted-foreground text-[10px] font-bold uppercase">
                          {notice.category}
                        </span>
                        {notice.scholarshipType && notice.scholarshipType !== 'Other' && (
                          <span className="px-2 py-1 rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-bold">
                            {notice.scholarshipType}
                          </span>
                        )}
                        {filterProfile.grade > 0 && notice.minGrade && filterProfile.grade >= notice.minGrade && (
                          <span className="px-2 py-1 rounded bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 text-[10px] font-bold border border-green-100 dark:border-green-800">
                            ✅ 학년 매칭
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground font-medium shrink-0">{notice.date}</span>
                    </div>

                    <h3 className="font-bold text-[17px] leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
                      {notice.title}
                    </h3>

                    {notice.summary && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {notice.summary}
                      </p>
                    )}

                    <div className="mt-auto pt-2 flex flex-wrap gap-2">
                      {notice.deadline && (
                        <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                          <Calendar className="w-3 h-3" /> ~{notice.deadline}
                        </span>
                      )}
                      {notice.minGrade && (
                        <span className="text-[11px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400 px-2 py-1 rounded">
                          Min {notice.minGrade}학년
                        </span>
                      )}
                      {notice.maxIncome !== null && (
                        <span className="text-[11px] font-bold text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-2 py-1 rounded">
                          소득 {notice.maxIncome}구간↓
                        </span>
                      )}
                      {notice.minGpa && (
                        <span className="text-[11px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400 px-2 py-1 rounded">
                          학점 {notice.minGpa}↑
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
