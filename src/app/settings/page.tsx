
'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Settings() {
    const [profile, setProfile] = useState({
        grade: 1,
        income: 10,
        trackId: ''
    });
    const [tracks, setTracks] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        // Load Tracks
        const tRes = await fetch('/api/curriculum');
        const tData = await tRes.json();
        if (tData.success) setTracks(tData.tracks);

        // Load Profile
        const pRes = await fetch('/api/user/profile');
        const pData = await pRes.json();
        if (pData.success && pData.profile) {
            setProfile({
                grade: pData.profile.grade,
                income: pData.profile.income,
                trackId: pData.profile.trackId ? String(pData.profile.trackId) : ''
            });
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/user/profile', {
                method: 'POST',
                body: JSON.stringify(profile)
            });
            alert('저장되었습니다.');
            window.location.href = '/';
        } catch (e) {
            alert('오류가 발생했습니다.');
        }
        setSaving(false);
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 font-sans text-foreground">
            <main className="max-w-xl mx-auto space-y-6">
                <header className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => window.location.href = '/'} className="-ml-2">
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-2xl font-bold">설정</h1>
                </header>

                <div className="space-y-4">
                    <Card className="p-6 rounded-[24px] border-border shadow-sm space-y-6 bg-card">
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-muted-foreground">학년</label>
                            <div className="grid grid-cols-4 gap-2">
                                {[1, 2, 3, 4].map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setProfile({ ...profile, grade: g })}
                                        className={`py-3 rounded-xl font-bold transition-all border ${profile.grade === g
                                            ? 'bg-primary text-primary-foreground shadow-md scale-[1.02] border-primary'
                                            : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent'
                                            }`}
                                    >
                                        {g}학년
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-bold text-muted-foreground">소득 구간 (학자금 지원구간)</label>
                            <select
                                className="w-full bg-muted/50 p-4 rounded-xl font-medium appearance-none focus:ring-2 focus:ring-primary/20 outline-none border border-transparent focus:border-primary/50"
                                value={profile.income}
                                onChange={(e) => setProfile({ ...profile, income: Number(e.target.value) })}
                            >
                                <option value={10}>9~10구간 (또는 해당없음)</option>
                                <option value={8}>8구간</option>
                                <option value={7}>7구간</option>
                                <option value={6}>6구간</option>
                                <option value={5}>5구간</option>
                                <option value={4}>4구간</option>
                                <option value={3}>3구간</option>
                                <option value={2}>2구간</option>
                                <option value={1}>1구간</option>
                                <option value={0}>기초/차상위 (0구간)</option>

                            </select>
                            <p className="text-xs text-muted-foreground px-1">
                                * 장학금 필터링에 사용됩니다. 실제 구간과 다를 수 있으니 참고용으로만 사용하세요.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <label className="text-sm font-bold text-muted-foreground">전공 트랙</label>
                            <div className="space-y-2">
                                {tracks.map(t => (
                                    <div
                                        key={t.id}
                                        onClick={() => setProfile({ ...profile, trackId: String(t.id) })}
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${String(profile.trackId) === String(t.id)
                                            ? 'border-primary bg-primary/10'
                                            : 'border-transparent bg-muted/50 hover:bg-muted'
                                            }`}
                                    >
                                        <span className={`font-bold ${String(profile.trackId) === String(t.id) ? 'text-primary' : 'text-foreground'}`}>
                                            {t.name}
                                        </span>
                                        {String(profile.trackId) === String(t.id) && (
                                            <div className="w-3 h-3 rounded-full bg-primary shadow-sm" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    <Button
                        size="lg"
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full h-14 rounded-[20px] text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                    >
                        {saving ? '저장 중...' : '저장하기'}
                    </Button>
                </div>
            </main>
        </div>
    );
}
