'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/ModeToggle';
import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Home, Calendar, Settings, Sparkles, LogIn, UserRound } from 'lucide-react';
import { getProviders, signIn, useSession } from 'next-auth/react';

export function NavBar() {
    const [isScrolled, setIsScrolled] = useState(false);
    const [hasAuthProvider, setHasAuthProvider] = useState<boolean | null>(null);
    const { scrollY } = useScroll();
    const { data: session, status } = useSession();

    // Dynamic padding based on scroll
    const padding = useTransform(scrollY, [0, 100], [24, 12]);
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

    const navItems = [
        { href: '/', label: '대시보드', icon: Home },
        { href: '/planning', label: '학사일정', icon: Calendar },
        { href: '/settings', label: '설정', icon: Settings },
    ];

    return (
        <motion.nav
            style={{ paddingTop: padding, paddingBottom: padding }}
            className={cn(
                "fixed top-0 left-0 right-0 z-50 px-6 flex justify-between items-center transition-all duration-500",
                isScrolled
                    ? "border-b border-border/40 bg-background/70 backdrop-blur-xl shadow-lg shadow-black/5"
                    : "bg-transparent border-transparent"
            )}
        >
            <motion.div style={{ scale: logoScale }} className="flex items-center gap-3">
                <Link href="/" className="hover:opacity-80 transition-all flex items-center gap-2">
                    {/* Mobile Logo (Shield) */}
                    <motion.img
                        src="/mobile-logo.png"
                        alt="충북대학교"
                        className="h-9 w-auto md:hidden block object-contain"
                        whileHover={{ rotate: [0, -5, 5, 0] }}
                        transition={{ duration: 0.5 }}
                    />
                    {/* Desktop Logo (Full Text) */}
                    <img
                        src="https://inform.chungbuk.ac.kr/layouts/INFORM/img/logo_d.png"
                        alt="충북대학교 정보통신공학부"
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

            <div className="flex gap-1 items-center">
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
                        className="hidden md:inline-flex h-9 px-3 rounded-xl text-muted-foreground hover:text-foreground"
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
                    <Link key={item.href} href={item.href}>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            <Button
                                variant="ghost"
                                className={cn(
                                    "text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all",
                                    isScrolled ? "h-9 px-3" : "h-10 px-4"
                                )}
                            >
                                <item.icon className={cn("mr-1.5", isScrolled ? "w-4 h-4" : "w-4 h-4")} />
                                <span className={isScrolled ? "hidden md:inline text-sm" : "text-sm"}>
                                    {item.label}
                                </span>
                            </Button>
                        </motion.div>
                    </Link>
                ))}

                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <ModeToggle />
                </motion.div>
            </div>
        </motion.nav>
    );
}
