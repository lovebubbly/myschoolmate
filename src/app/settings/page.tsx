'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface Track {
    id: number;
    name: string;
}

export default function Settings() {
    const [grade, setGrade] = useState('1');
    const [income, setIncome] = useState('10');
    const [gpa, setGpa] = useState('0.0');
    const [trackId, setTrackId] = useState<string>('');
    const [tracks, setTracks] = useState<Track[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchTracks();
        fetchProfile();
    }, []);

    const fetchTracks = async () => {
        const res = await fetch('/api/curriculum');
        const data = await res.json();
        if (data.success) setTracks(data.tracks);
    };

    const fetchProfile = async () => {
        const res = await fetch('/api/user/profile');
        const data = await res.json();
        if (data.success && data.profile) {
            setGrade(String(data.profile.grade));
            setIncome(String(data.profile.income));
            setGpa(String(data.profile.gpa || '0.0'));
            setTrackId(String(data.profile.trackId || ''));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grade: parseInt(grade),
                    income: parseInt(income),
                    gpa: parseFloat(gpa),
                    trackId: trackId ? parseInt(trackId) : null
                })
            });
            window.location.href = '/';
        } catch (e) {
            console.error('Failed to save profile:', e);
        }
        setSaving(false);
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 font-sans text-foreground flex flex-col items-center justify-center">
            <main className="w-full max-w-md space-y-6">
                <header className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => window.location.href = '/'} className="-ml-2">
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-2xl font-bold">내 정보 설정 ⚙️</h1>
                </header>

                <Card className="p-6 rounded-[24px] border-border shadow-sm space-y-6 bg-card">

                    {/* Grade */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-muted-foreground">학년</label>
                        <select
                            className="w-full bg-muted/50 p-4 rounded-xl font-medium appearance-none focus:ring-2 focus:ring-primary/20 outline-none border border-transparent focus:border-primary/50"
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                        >
                            {[1, 2, 3, 4].map(g => <option key={g} value={g}>{g}학년</option>)}
                        </select>
                    </div>

                    {/* Income */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-muted-foreground">소득 구간 (학자금 지원구간)</label>
                        <select
                            className="w-full bg-muted/50 p-4 rounded-xl font-medium appearance-none focus:ring-2 focus:ring-primary/20 outline-none border border-transparent focus:border-primary/50"
                            value={income}
                            onChange={(e) => setIncome(e.target.value)}
                        >
                            <option value="10">9~10구간 (해당없음)</option>
                            <option value="8">8구간</option>
                            <option value="7">7구간</option>
                            <option value="6">6구간</option>
                            <option value="5">5구간</option>
                            <option value="4">4구간</option>
                            <option value="3">3구간</option>
                            <option value="2">2구간</option>
                            <option value="1">1구간</option>
                            <option value="0">기초/차상위</option>
                        </select>
                        <p className="text-xs text-muted-foreground px-1">
                            * 장학금 필터링에 사용됩니다.
                        </p>
                    </div>

                    {/* GPA */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-muted-foreground">학점 (GPA)</label>
                        <input
                            type="number"
                            step="0.1"
                            className="w-full bg-muted/50 p-4 rounded-xl font-medium focus:ring-2 focus:ring-primary/20 outline-none border border-transparent focus:border-primary/50"
                            value={gpa}
                            onChange={(e) => setGpa(e.target.value)}
                            placeholder="Ex: 3.5"
                        />
                    </div>

                    {/* Track */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-muted-foreground">전공 트랙</label>
                        <div className="space-y-2">
                            <div
                                onClick={() => setTrackId('')}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${!trackId
                                    ? 'border-primary bg-primary/10'
                                    : 'border-transparent bg-muted/50 hover:bg-muted'
                                    }`}
                            >
                                <span className={`font-bold ${!trackId ? 'text-primary' : 'text-foreground'}`}>
                                    선택 안함 (1학년 등)
                                </span>
                                {!trackId && <div className="w-3 h-3 rounded-full bg-primary shadow-sm" />}
                            </div>
                            {tracks.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => setTrackId(String(t.id))}
                                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${String(trackId) === String(t.id)
                                        ? 'border-primary bg-primary/10'
                                        : 'border-transparent bg-muted/50 hover:bg-muted'
                                        }`}
                                >
                                    <span className={`font-bold ${String(trackId) === String(t.id) ? 'text-primary' : 'text-foreground'}`}>
                                        {t.name}
                                    </span>
                                    {String(trackId) === String(t.id) && (
                                        <div className="w-3 h-3 rounded-full bg-primary shadow-sm" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button
                        size="lg"
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full h-14 rounded-[20px] text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                    >
                        {saving ? '저장 중...' : '저장하기'}
                    </Button>
                </Card>
            </main>
        </div>
    );
}
