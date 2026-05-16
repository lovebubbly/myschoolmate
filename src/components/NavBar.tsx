'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/ModeToggle';
import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BellRing, Calendar, CheckCheck, Clock3, Home, LogIn, Settings, Sparkles, UserRound, X } from 'lucide-react';
import { getProviders, signIn, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

type NavInboxItem = {
    id: string;
    noticeId: number;
    type: 'NEW_NOTICE' | 'DEADLINE_SOON' | 'EASY_TO_MISS';
    title: string;
    subtitle: string;
};

type NavInboxSummary = {
    unreadNoticeCount: number;
    urgentInboxCount: number;
    easyToMissCount: number;
    items: NavInboxItem[];
};

const EMPTY_INBOX_SUMMARY: NavInboxSummary = {
    unreadNoticeCount: 0,
    urgentInboxCount: 0,
    easyToMissCount: 0,
    items: [],
};

export function NavBar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [hasAuthProvider, setHasAuthProvider] = useState<boolean | null>(null);
    const [inboxOpen, setInboxOpen] = useState(false);
    const [inboxSummary, setInboxSummary] = useState<NavInboxSummary>(EMPTY_INBOX_SUMMARY);
    const inboxRef = useRef<HTMLDivElement | null>(null);
    const { scrollY } = useScroll();
    const { data: session, status } = useSession();
    const pathname = usePathname();
    const showInbox = pathname === '/';

    // Dynamic padding based on scroll
    const padding = useTransform(scrollY, [0, 100], [18, 10]);
    const logoScale = useTransform(scrollY, [0, 100], [1, 0.9]);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        async function loadProviders() {
            try {
                const providers = await getProviders();
                setHasAuthProvider(Boolean(providers && Object.keys(providers).length > 0));
            } catch {
                setHasAuthProvider(false);
            }
        }
        void loadProviders();
    }, []);

    useEffect(() => {
        const handleSummary = (event: Event) => {
            const detail = (event as CustomEvent<Partial<NavInboxSummary>>).detail;
            setInboxSummary({
                unreadNoticeCount: Number(detail?.unreadNoticeCount) || 0,
                urgentInboxCount: Number(detail?.urgentInboxCount) || 0,
                easyToMissCount: Number(detail?.easyToMissCount) || 0,
                items: Array.isArray(detail?.items) ? detail.items.slice(0, 12) as NavInboxItem[] : [],
            });
        };

        window.addEventListener('myschoolmate:inbox-summary', handleSummary);
        return () => window.removeEventListener('myschoolmate:inbox-summary', handleSummary);
    }, []);

    useEffect(() => {
        if (!inboxOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!inboxRef.current || inboxRef.current.contains(event.target as Node)) return;
            setInboxOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setInboxOpen(false);
        };

        window.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [inboxOpen]);

    const navItems = [
        { href: '/', label: '대시보드', icon: Home },
        { href: '/planning', label: '학사일정', icon: Calendar },
        { href: '/settings', label: '설정', icon: Settings },
    ];

    const inboxCount = inboxSummary.items.length;
    const displayInboxCount = inboxCount > 99 ? '99+' : String(inboxCount);

    return (
        <motion.nav
            style={{ paddingTop: padding, paddingBottom: padding }}
            className={cn(
                "fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 flex justify-between items-center transition-[background-color,border-color,box-shadow] duration-300",
                isScrolled
                    ? "border-b border-border/40 bg-background/70 backdrop-blur-xl shadow-lg shadow-black/5"
                    : "bg-transparent border-transparent"
            )}
            data-theme-surface
        >
            <motion.div style={{ scale: logoScale }} className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Link href="/" className="hover:opacity-80 transition-all flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Mobile Logo (Shield) */}
                    <motion.div
                        className="md:hidden block"
                        whileHover={{ rotate: [0, -5, 5, 0] }}
                        transition={{ duration: 0.5 }}
                    >
                        <Image
                            src="/mobile-logo.png"
                            alt="충북대학교"
                            width={393}
                            height={474}
                            priority
                            className="h-8 w-auto object-contain"
                        />
                    </motion.div>
                    {/* Desktop Logo */}
                    <Image
                        src="/mobile-logo.png"
                        alt="충북대학교 정보통신공학부"
                        width={393}
                        height={474}
                        priority
                        className="h-8 w-auto hidden md:block brightness-0 dark:brightness-100 dark:invert-0"
                    />
                </Link>

                {/* AI Badge */}
                {isScrolled && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, x: -10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        className="hidden md:flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-primary/20"
                    >
                        <Sparkles className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                            AI Assistant
                        </span>
                    </motion.div>
                )}
            </motion.div>

            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                {status === 'authenticated' ? (
                    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mr-1">
                        <UserRound className="w-3.5 h-3.5" />
                        {session?.user?.name || session?.user?.email || '로그인됨'}
                    </div>
                ) : hasAuthProvider ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => signIn(undefined, { callbackUrl: '/settings' })}
                        className="hidden md:inline-flex h-9 px-3 rounded-full text-muted-foreground hover:text-foreground"
                    >
                        <LogIn className="w-4 h-4 mr-1.5" />
                        로그인
                    </Button>
                ) : (
                    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border/50 bg-muted/30 text-muted-foreground text-xs font-semibold mr-1">
                        익명 모드
                    </div>
                )}

                {navItems.map((item) => (
                    <motion.div
                        key={item.href}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="shrink-0"
                    >
                        <Button
                            asChild
                            variant="ghost"
                            className={cn(
                                pathname === item.href ? "text-foreground bg-muted/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                                "h-9 px-2 sm:px-3 text-base"
                            )}
                        >
                            <Link
                                href={item.href}
                                aria-current={pathname === item.href ? "page" : undefined}
                                aria-label={item.label}
                                className="inline-flex items-center"
                            >
                                <span className="sr-only">{item.label}</span>
                                <item.icon className="w-4 h-4 md:mr-1.5" />
                                <span className="hidden md:inline text-sm">
                                    {item.label}
                                </span>
                            </Link>
                        </Button>
                    </motion.div>
                ))}

                {showInbox && (
                    <div className="relative shrink-0" ref={inboxRef}>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                data-testid="nav-inbox-toggle"
                                aria-label={inboxOpen ? '알림함 닫기' : '알림함 열기'}
                                aria-expanded={inboxOpen}
                                onClick={() => setInboxOpen((open) => !open)}
                                className={cn(
                                    "relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50",
                                    inboxOpen && "bg-muted/60 text-foreground",
                                )}
                            >
                                <BellRing className="w-4 h-4" />
                                {inboxCount > 0 && (
                                    <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[9px] font-black leading-4 text-white ring-2 ring-background">
                                        {displayInboxCount}
                                    </span>
                                )}
                            </Button>
                        </motion.div>

                        <AnimatePresence>
                            {inboxOpen && (
                                <motion.div
                                    data-testid="nav-inbox-drawer"
                                    role="dialog"
                                    aria-label="알림함"
                                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                                    className="fixed left-3 right-3 top-20 z-[60] rounded-[22px] border border-border/60 bg-popover/95 p-4 text-popover-foreground shadow-2xl shadow-black/10 backdrop-blur-xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[360px]"
                                    data-theme-surface
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h2 className="text-sm font-extrabold tracking-tight">알림함</h2>
                                            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                                                <span className="rounded-full bg-blue-500/10 px-2 py-1 text-blue-600 dark:text-blue-300">
                                                    새 공지 {inboxSummary.unreadNoticeCount}
                                                </span>
                                                <span className="rounded-full bg-rose-500/10 px-2 py-1 text-rose-600 dark:text-rose-300">
                                                    마감 임박 {inboxSummary.urgentInboxCount}
                                                </span>
                                                <span className="rounded-full bg-orange-500/10 px-2 py-1 text-orange-700 dark:text-orange-300">
                                                    놓치기 쉬움 {inboxSummary.easyToMissCount}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                aria-label="알림 모두 읽음"
                                                disabled={inboxSummary.unreadNoticeCount === 0}
                                                onClick={() => window.dispatchEvent(new CustomEvent('myschoolmate:mark-all-read'))}
                                                className="h-8 w-8 rounded-full"
                                            >
                                                <CheckCheck className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                aria-label="알림함 닫기"
                                                onClick={() => setInboxOpen(false)}
                                                className="h-8 w-8 rounded-full"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="mt-4 max-h-[min(56vh,420px)] space-y-2 overflow-y-auto pr-1">
                                        {inboxSummary.items.length === 0 ? (
                                            <div className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-6 text-center text-sm font-semibold text-muted-foreground">
                                                새로운 알림이 없습니다.
                                            </div>
                                        ) : (
                                            inboxSummary.items.map((item) => {
                                                const tone = item.type === 'DEADLINE_SOON'
                                                    ? 'text-rose-600 dark:text-rose-300 bg-rose-500/10 border-rose-500/20'
                                                    : item.type === 'EASY_TO_MISS'
                                                        ? 'text-orange-700 dark:text-orange-300 bg-orange-500/10 border-orange-500/20'
                                                        : 'text-blue-600 dark:text-blue-300 bg-blue-500/10 border-blue-500/20';
                                                const label = item.type === 'DEADLINE_SOON' ? '마감 임박' : item.type === 'EASY_TO_MISS' ? '놓치기 쉬움' : '새 공지';

                                                return (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        data-testid="nav-inbox-item"
                                                        aria-label={`공지 상세 열기: ${item.title}`}
                                                        onClick={() => {
                                                            window.dispatchEvent(new CustomEvent('myschoolmate:open-notice', { detail: { noticeId: item.noticeId } }));
                                                            setInboxOpen(false);
                                                        }}
                                                        className="w-full rounded-2xl border border-border/50 bg-background/70 p-3 text-left transition-colors hover:bg-muted/50"
                                                    >
                                                        <div className="mb-1.5 flex items-center gap-2">
                                                            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-black", tone)}>
                                                                {label}
                                                            </span>
                                                            <span className="inline-flex min-w-0 items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                                                {item.type === 'DEADLINE_SOON' && <Clock3 className="h-3 w-3 shrink-0" />}
                                                                <span className="truncate">{item.subtitle}</span>
                                                            </span>
                                                        </div>
                                                        <p className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
                                                            {item.title}
                                                        </p>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                <div className="ml-0.5 sm:ml-1 pl-0.5 sm:pl-1 border-l border-border/50 flex items-center shrink-0">
                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                        <ModeToggle className="h-9 w-9 sm:h-10 sm:w-10" />
                    </motion.div>
                </div>
            </div>
        </motion.nav>
    );
}
