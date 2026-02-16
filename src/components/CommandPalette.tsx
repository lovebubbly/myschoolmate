'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type NoticeLite = {
  id: number;
  title: string;
  dday?: number | null;
};

type CommandPaletteProps = {
  notices: NoticeLite[];
  onOpenNotice: (noticeId: number) => void;
  onRefresh?: () => void;
  onToggleFilters?: () => void;
};

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  run: () => void;
};

function normalize(text: string) {
  return text.trim().toLowerCase();
}

export function CommandPalette({
  notices,
  onOpenNotice,
  onRefresh,
  onToggleFilters,
}: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const actions = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      {
        id: 'nav-dashboard',
        label: '대시보드로 이동',
        hint: '/',
        keywords: ['dashboard', 'home'],
        run: () => router.push('/'),
      },
      {
        id: 'nav-planning',
        label: '학사일정으로 이동',
        hint: '/planning',
        keywords: ['planning', 'curriculum'],
        run: () => router.push('/planning'),
      },
      {
        id: 'nav-settings',
        label: '설정으로 이동',
        hint: '/settings',
        keywords: ['settings', 'profile'],
        run: () => router.push('/settings'),
      },
    ];

    if (onRefresh) {
      list.push({
        id: 'action-refresh',
        label: '공지 새로고침 (크롤 포함)',
        keywords: ['refresh', 'crawl', 'notices'],
        run: onRefresh,
      });
    }

    if (onToggleFilters) {
      list.push({
        id: 'action-toggle-filters',
        label: '상세 필터 열기/닫기',
        keywords: ['filter'],
        run: onToggleFilters,
      });
    }

    return list;
  }, [onRefresh, onToggleFilters, router]);

  const noticeMatches = useMemo(() => {
    const q = normalize(query);
    if (!q) return [] as NoticeLite[];

    const limit = 8;
    const byTitle = notices
      .filter((n) => normalize(n.title).includes(q))
      .sort((a, b) => {
        const aDday = typeof a.dday === 'number' ? a.dday : Number.POSITIVE_INFINITY;
        const bDday = typeof b.dday === 'number' ? b.dday : Number.POSITIVE_INFINITY;
        return aDday - bDday || b.id - a.id;
      })
      .slice(0, limit);

    return byTitle;
  }, [notices, query]);

  const actionMatches = useMemo(() => {
    const q = normalize(query);
    if (!q) return actions;
    return actions.filter((a) => {
      if (normalize(a.label).includes(q)) return true;
      for (const k of a.keywords || []) {
        if (normalize(k).includes(q)) return true;
      }
      return false;
    });
  }, [actions, query]);

  const items = useMemo(() => {
    const list: Array<{ kind: 'notice' | 'action'; id: string; label: string; hint?: string; run: () => void }> = [];

    for (const n of noticeMatches) {
      list.push({
        kind: 'notice',
        id: `notice-${n.id}`,
        label: n.title,
        hint:
          typeof n.dday === 'number'
            ? (n.dday === 0
              ? 'D-Day'
              : n.dday > 0
                ? `D-${n.dday}`
                : '마감 지남')
            : undefined,
        run: () => onOpenNotice(n.id),
      });
    }

    for (const a of actionMatches) {
      list.push({
        kind: 'action',
        id: a.id,
        label: a.label,
        hint: a.hint,
        run: a.run,
      });
    }

    return list;
  }, [actionMatches, noticeMatches, onOpenNotice]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      const isMac = navigator.platform.toLowerCase().includes('mac');
      const hotkey = (isMac && event.metaKey && key === 'k') || (!isMac && event.ctrlKey && key === 'k');

      if (hotkey) {
        event.preventDefault();
        if (!open) {
          setQuery('');
          setActiveIndex(0);
          setOpen(true);
        } else {
          setOpen(false);
        }
        return;
      }

      if (!open) return;

      if (key === 'escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (key === 'arrowdown') {
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, Math.max(items.length - 1, 0)));
        return;
      }

      if (key === 'arrowup') {
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (key === 'enter') {
        event.preventDefault();
        const item = items[activeIndex];
        if (!item) return;
        item.run();
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, items, open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setActiveIndex(0);
        }
      }}
    >
      <DialogContent className="max-w-[92vw] sm:max-w-[720px] rounded-[24px]">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold">명령 팔레트</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="공지 검색 또는 명령 입력..."
            className="h-11 rounded-xl"
            aria-label="명령 팔레트 입력"
          />

          <div className="max-h-[52vh] overflow-auto rounded-xl border border-border/60 bg-background/60">
            {items.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">검색 결과가 없습니다.</div>
            ) : (
              <div className="p-2">
                {items.map((item, idx) => {
                  const active = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        item.run();
                        setOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between gap-3 transition-colors ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/60'}`}
                    >
                      <span className="text-sm font-semibold line-clamp-1">
                        {item.label}
                      </span>
                      {item.hint ? (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${active ? 'border-primary-foreground/30' : 'border-border/50 text-muted-foreground'}`}>
                          {item.hint}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            단축키: Mac은 ⌘K, Windows/Linux는 Ctrl+K
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
