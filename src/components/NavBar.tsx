'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/ModeToggle';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export function NavBar() {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav
            className={cn(
                "fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center transition-all duration-300",
                isScrolled
                    ? "border-b border-border/40 bg-background/70 backdrop-blur-xl shadow-sm"
                    : "bg-transparent border-transparent"
            )}
        >
            <div className="flex items-center gap-2">
                <Link href="/" className="hover:opacity-80 transition-opacity">
                    <img
                        src="https://inform.chungbuk.ac.kr/layouts/INFORM/img/logo_d.png"
                        alt="충북대학교 정보통신공학부"
                        className="h-8 w-auto brightness-0 dark:brightness-100 dark:invert-0"
                    />
                </Link>
            </div>
            <div className="flex gap-2 items-center">
                <Link href="/">
                    <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl">대시보드</Button>
                </Link>
                <Link href="/planning">
                    <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl">학사일정</Button>
                </Link>
                <Link href="/settings">
                    <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl">설정</Button>
                </Link>
                <ModeToggle />
            </div>
        </nav>
    );
}
