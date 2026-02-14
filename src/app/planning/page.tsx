
'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

interface Profile {
    trackId?: number | null;
}

interface TrackCourse {
    id: string;
    code: string;
    name: string;
    category: string;
    credit: string;
    term: string;
    year: string;
    requiredName: string;
}

interface Track {
    id: number;
    key: string;
    name: string;
    required: string[];
    courses: TrackCourse[];
    missingRequired: string[];
    sourceYear: string | null;
}

export default function Planning() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [tracks, setTracks] = useState<Track[]>([]);

    async function loadData() {
        const pRes = await fetch('/api/user/profile', { cache: 'no-store' }); // Disable cache
        const pData = await pRes.json();
        if (pData.success) {
            setProfile(pData.profile);
        }

        const tRes = await fetch('/api/curriculum');
        const tData = await tRes.json();
        if (tData.success) {
            setTracks(tData.tracks);
        }
    }

    // Initial page hydration: load profile + curriculum once.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadData();
    }, []);

    const currentTrack = tracks.find(t => String(t.id) === String(profile?.trackId));
    const courses = currentTrack?.courses || [];
    const missingRequired = currentTrack?.missingRequired || [];

    // Fallback if no track selected
    if (!profile) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-[#f2f4f6] p-4 md:p-8 font-sans text-[#191f28]">
            <main className="max-w-3xl mx-auto space-y-6">
                <header className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => window.location.href = '/'} className="-ml-2">
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-2xl font-bold">커리큘럼 플래너</h1>
                </header>

                {!currentTrack ? (
                    <Card className="p-8 text-center rounded-[24px] space-y-4">
                        <p className="text-gray-500">선택된 트랙이 없습니다.</p>
                        <Button onClick={() => window.location.href = '/settings'}>트랙 설정하러 가기</Button>
                    </Card>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-blue-600 text-white p-6 rounded-[24px] shadow-lg shadow-blue-200">
                            <h2 className="text-lg opacity-80 font-medium mb-1">나의 트랙</h2>
                            <h1 className="text-3xl font-bold">{currentTrack.name}</h1>
                            <p className="mt-4 opacity-90 text-sm leading-relaxed">
                                필수 과목 {currentTrack.required.length}개 중 {courses.length}개를 매핑했습니다.
                                {currentTrack.sourceYear ? ` (기준 연도: ${currentTrack.sourceYear})` : ''}
                            </p>
                        </div>

                        {missingRequired.length > 0 && (
                            <Card className="p-5 rounded-[20px] bg-amber-50 border-amber-200 text-amber-900">
                                <p className="font-bold text-sm mb-2">
                                    매핑되지 않은 필수 과목 {missingRequired.length}개
                                </p>
                                <p className="text-xs leading-relaxed">
                                    {missingRequired.join(' / ')}
                                </p>
                            </Card>
                        )}

                        <div className="grid gap-3">
                            {courses.length === 0 ? (
                                <p className="text-center text-gray-400 py-10">
                                    현재 트랙의 매핑된 과목 정보가 없습니다.
                                </p>
                            ) : (
                                courses.map((c) => (
                                    <div key={c.id} className="bg-white p-5 rounded-[20px] shadow-sm flex justify-between items-center group hover:scale-[1.01] transition-transform">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded font-bold">
                                                    {c.category || '전공'} · {c.term}
                                                </span>
                                                <span className="text-xs text-gray-400">{c.credit}</span>
                                            </div>
                                            <h3 className="font-bold text-lg text-[#333d4b] group-hover:text-blue-600 transition-colors">
                                                {c.name}
                                            </h3>
                                            <p className="text-xs text-gray-400">
                                                필수명: {c.requiredName} · 코드: {c.code}
                                            </p>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="text-gray-300 hover:text-blue-500">
                                                <CheckCircle2 className="w-6 h-6" />
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
