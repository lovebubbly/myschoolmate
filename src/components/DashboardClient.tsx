
'use client';

import React, { useEffect, useState } from 'react';
import { NoticeCard } from '@/components/NoticeCard';
import { Mascot } from '@/components/Mascot';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Notice {
    id: number;
    title: string;
    url: string;
    category: string;
    date: string;
    minGrade: number | null;
    maxIncome: number | null;
    minGpa: number | null;
}

export default function DashboardClient({ initialNotices }: { initialNotices: Notice[] }) {
    // Filters State
    const [profile, setProfile] = useState({
        grade: '',
        income: '',
        track: '',
    });

    const [briefing, setBriefing] = useState<string>('');
    const [loadingAI, setLoadingAI] = useState(false);

    useEffect(() => {
        // Load from Local Storage
        const saved = localStorage.getItem('myschoolmate-profile');
        if (saved) {
            setProfile(JSON.parse(saved));
        }
    }, []);

    useEffect(() => {
        // Save to Local Storage
        localStorage.setItem('myschoolmate-profile', JSON.stringify(profile));
    }, [profile]);

    const handleProfileChange = (key: string, value: string) => {
        setProfile(prev => ({ ...prev, [key]: value }));
    };

    const getBriefing = async () => {
        setLoadingAI(true);
        try {
            const res = await fetch('/api/briefing', {
                method: 'POST',
                body: JSON.stringify({ userProfile: `Grade: ${profile.grade}, Income: ${profile.income}, Track: ${profile.track}` }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            setBriefing(data.briefing);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAI(false);
        }
    };

    // Filter Logic
    const filteredNotices = initialNotices.filter(n => {
        // Basic Keyword Filtering
        // If notice has minGrade (e.g. 3) and user grade is (e.g. 1), filter OUT.
        if (n.minGrade && profile.grade) {
            if (parseInt(profile.grade) < n.minGrade) return false;
        }
        // If notice has maxIncome (e.g. 8) and user income is (e.g. 9), filter OUT.
        if (n.maxIncome && profile.income) {
            if (parseInt(profile.income) > n.maxIncome) return false;
        }
        return true;
    });

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header & Settings */}
            <section className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">MySchoolMate 🎓</h1>
                    <p className="text-slate-500">CBNU Information & Comm. Engineering Assistant</p>
                </div>

                <div className="flex gap-2">
                    <Select value={profile.grade} onValueChange={(v) => handleProfileChange('grade', v)}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Grade" />
                        </SelectTrigger>
                        <SelectContent>
                            {[1, 2, 3, 4].map(g => <SelectItem key={g} value={String(g)}>{g}학년</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={profile.income} onValueChange={(v) => handleProfileChange('income', v)}>
                        <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="Income" />
                        </SelectTrigger>
                        <SelectContent>
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <SelectItem key={i} value={String(i)}>{i}구간</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </section>

            {/* AI Briefing Section */}
            <section>
                <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-none shadow-sm">
                    <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-xl text-indigo-900">✨ Today&apos;s AI Briefing</CardTitle>
                            <Button size="sm" variant="outline" onClick={getBriefing} disabled={loadingAI}>
                                {loadingAI ? 'Generating...' : 'Refresh'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {briefing ? (
                            <div className="prose prose-sm text-slate-700 whitespace-pre-wrap">
                                {briefing}
                            </div>
                        ) : (
                            <p className="text-slate-400 italic">Click Refresh to get your personalized summary.</p>
                        )}
                    </CardContent>
                </Card>
            </section>

            <Separator />

            {/* Notice List */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredNotices.map(notice => (
                    <NoticeCard key={notice.id} notice={notice} />
                ))}
                {filteredNotices.length === 0 && (
                    <div className="col-span-full text-center py-10 text-gray-400">
                        No notices match your filters currently.
                    </div>
                )}
            </section>

            <Mascot message={briefing ? "확인해야 할 공지가 있네요!" : undefined} />
        </div>
    );
}
