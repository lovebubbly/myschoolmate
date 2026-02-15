
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Utensils, RefreshCw, Coffee, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';

type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER';

interface MenuItem {
    id: number;
    restaurant: string;
    date: string;
    mealType: string;
    menuContent: string;
    price?: string;
}

export function CafeteriaWidget() {
    const [menus, setMenus] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedRest, setSelectedRest] = useState('Hanbit');
    const [selectedMeal, setSelectedMeal] = useState<MealType>('LUNCH');
    const [selectedDate, setSelectedDate] = useState(new Date());

    const formatDate = useCallback((date: Date) => {
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${m}.${d}`;
    }, []);

    const fetchMenus = useCallback(async (date: Date) => {
        setLoading(true);
        try {
            const dateStr = formatDate(date);
            const res = await fetch(`/api/menu?date=${dateStr}`);
            const data = await res.json();
            if (data.success) {
                setMenus(data.menus);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, [formatDate]);

    const getDayLabel = useCallback((date: Date) => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);

        if (start.getTime() === target.getTime()) return '오늘';
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return `${formatDate(date)}(${days[date.getDay()]})`;
    }, [formatDate]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchMenus(selectedDate);

        const isToday = new Date().toDateString() === selectedDate.toDateString();
        if (isToday) {
            const hour = new Date().getHours();
            if (hour < 10) setSelectedMeal('BREAKFAST');
            else if (hour < 14) setSelectedMeal('LUNCH');
            else setSelectedMeal('DINNER');
        }
    }, [fetchMenus, selectedDate]);

    const changeDate = (days: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        setSelectedDate(newDate);
    };

    const refreshMenu = async () => {
        setLoading(true);
        try {
            await fetch('/api/menu', { method: 'POST' });
            await fetchMenus(selectedDate);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    // Helper to check if a meal type has data for the selected restaurant
    const hasMenu = (mealType: string, rest: string = selectedRest) => {
        return menus.some(m =>
            m.restaurant === rest &&
            (m.mealType === mealType || m.mealType.includes(mealType))
        );
    };

    const currentMenu = menus.find(m =>
        m.restaurant === selectedRest &&
        (m.mealType === selectedMeal || m.mealType.includes(selectedMeal))
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{
                y: -3,
                transition: { duration: 0.2 }
            }}
        >
            <Card className="relative overflow-hidden border-border/40 bg-card/60 backdrop-blur-md p-6 rounded-[32px] shadow-sm hover:shadow-xl hover:shadow-orange-500/5 transition-all duration-300 hover:border-orange-200/30 dark:hover:border-orange-800/30">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-br from-orange-100 to-rose-100 dark:from-orange-950/30 dark:to-rose-950/30 p-2.5 rounded-2xl">
                            <Utensils className="w-5 h-5 text-orange-500" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full hover:bg-muted/50"
                                onClick={() => changeDate(-1)}
                                aria-label="이전 날짜"
                            >
                                <span className="text-lg text-muted-foreground/70">‹</span>
                            </Button>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent transform translate-y-[1px]">
                                {getDayLabel(selectedDate)} 학식
                            </h2>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full hover:bg-muted/50"
                                onClick={() => changeDate(1)}
                                aria-label="다음 날짜"
                            >
                                <span className="text-lg text-muted-foreground/70">›</span>
                            </Button>
                        </div>
                    </div>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={refreshMenu}
                        disabled={loading}
                        className="h-8 w-8 p-0 rounded-full hover:bg-muted/50"
                        aria-label="학식 메뉴 새로고침"
                    >
                        <RefreshCw className={`w-4 h-4 text-muted-foreground/50 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>

                {/* Restaurant Tabs (Sliding Pill) */}
                <div className="flex p-1 mb-6 bg-muted/40 rounded-full relative">
                    {['Hanbit', 'Star', 'Eunhasu'].map(rest => (
                        <button
                            key={rest}
                            type="button"
                            aria-label={`${rest} 식당 학식 보기`}
                            onClick={() => setSelectedRest(rest)}
                            className={`flex-1 relative py-2 text-sm font-bold rounded-full transition-colors z-10 ${selectedRest === rest ? 'text-white' : 'text-muted-foreground hover:text-foreground/80'}`}
                        >
                            {selectedRest === rest && (
                                <motion.div
                                    layoutId="cafeteriaRestTab"
                                    className="absolute inset-0 bg-orange-500 rounded-full shadow-sm shadow-orange-500/20"
                                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                                />
                            )}
                            <span className="relative z-10">{rest === 'Hanbit' ? '한빛' : rest === 'Star' ? '별빛' : '은하수'}</span>
                        </button>
                    ))}
                </div>

                {/* Meal Time Tabs (Dynamic Icon) */}
                <div className="flex justify-center gap-6 mb-6">
                    {[
                        { id: 'BREAKFAST' as MealType, label: '아침', icon: Coffee },
                        { id: 'LUNCH' as MealType, label: '점심', icon: Sun },
                        { id: 'DINNER' as MealType, label: '저녁', icon: Moon }
                    ].map(type => {
                        const isActive = selectedMeal === type.id;
                        const isAvailable = hasMenu(type.id);

                        return (
                            <button
                                key={type.id}
                                type="button"
                                aria-label={`${type.label} 식사 시간 학식 보기`}
                                onClick={() => isAvailable && setSelectedMeal(type.id)}
                                disabled={!isAvailable}
                                className={`flex flex-col items-center gap-2 group transition-all ${!isAvailable ? 'opacity-30 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <div className={`p-3.5 rounded-[20px] transition-all duration-300 ${isActive ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25 scale-110' : 'bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:scale-105'}`}>
                                    <type.icon className="w-5 h-5" strokeWidth={2.5} />
                                </div>
                                <span className={`text-[11px] font-bold tracking-tight ${isActive ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>{type.label}</span>
                            </button>
                        )
                    })}
                </div>

                {/* Menu Content */}
                <AnimatePresence mode='wait'>
                    <motion.div
                        key={`${selectedRest}-${selectedMeal}-${selectedDate.toISOString()}`}
                        initial={{ opacity: 0, scale: 0.95, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        transition={{ duration: 0.2 }}
                        className="min-h-[140px] flex flex-col items-center justify-center text-center p-5 bg-gradient-to-b from-muted/20 to-muted/40 rounded-[24px] border border-border/40"
                    >
                        {currentMenu ? (
                            <>
                                <div className="text-[16px] font-bold leading-relaxed whitespace-pre-line text-foreground/90">
                                    {currentMenu.menuContent}
                                </div>
                                {currentMenu.price && (
                                    <div className="mt-4 text-xs font-bold text-muted-foreground/80 bg-background/50 px-3 py-1.5 rounded-full border border-black/5 dark:border-white/5 backdrop-blur-sm">
                                        {currentMenu.price}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="text-muted-foreground/60 text-sm flex flex-col items-center gap-3">
                                <Utensils className="w-8 h-8 opacity-20" />
                                <span>오늘은 운영하지 않아요</span>
                                {loading && <span className="text-xs opacity-70 animate-pulse">메뉴 확인 중...</span>}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </Card>
        </motion.div>
    );
}
