
'use client';

import React, { useState, useEffect } from 'react';
import curriculumData from '@/lib/curriculum.json';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';

// Type definitions
type Course = { code: string; name: string; type: string; credit: number; };
type SemesterData = Record<string, Course[]>;
type TrackData = { name: string; required: string[]; };

export default function CoursePlanner() {
    const [takenCourses, setTakenCourses] = useState<string[]>(() => {
        if (typeof window === 'undefined') return [];
        const saved = localStorage.getItem('myschoolmate-taken');
        if (!saved) return [];
        try {
            const parsed = JSON.parse(saved);
            return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
        } catch {
            return [];
        }
    });
    const [selectedTrack, setSelectedTrack] = useState<string>('info_net');

    const curriculum = curriculumData['2025'] as SemesterData;
    const tracks = curriculumData['tracks'] as Record<string, TrackData>;

    useEffect(() => {
        localStorage.setItem('myschoolmate-taken', JSON.stringify(takenCourses));
    }, [takenCourses]);

    const toggleCourse = (name: string) => {
        setTakenCourses(prev =>
            prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
        );
    };

    const calculateProgress = (trackKey: string) => {
        const track = tracks[trackKey];
        const takenCount = track.required.filter(r => takenCourses.includes(r)).length;
        return (takenCount / track.required.length) * 100;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar / Track Status */}
                <Card className="w-full md:w-1/3 h-fit">
                    <CardHeader>
                        <CardTitle>🎓 졸업 요건 달성도</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {Object.entries(tracks).map(([key, track]) => {
                            const progress = calculateProgress(key);
                            const isSelected = selectedTrack === key;
                            return (
                                <div
                                    key={key}
                                    className={`p-3 rounded-2xl cursor-pointer transition-all duration-200 border ${isSelected ? 'bg-primary/10 border-primary/20 ring-1 ring-primary/20' : 'bg-transparent border-transparent hover:bg-muted'}`}
                                    onClick={() => setSelectedTrack(key)}
                                >
                                    <div className="flex justify-between mb-2">
                                        <span className={`font-semibold text-sm ${isSelected ? 'text-primary' : 'text-foreground'}`}>{track.name}</span>
                                        <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                                    </div>
                                    <Progress value={progress} className={isSelected ? "h-2" : "h-2 bg-muted"} />
                                </div>
                            );
                        })}

                        <div className="text-xs text-muted-foreground mt-4 px-1">
                            * 트랙을 선택하면 필수 수강 과목이 강조됩니다.
                        </div>
                    </CardContent>
                </Card>

                {/* Main Curriculum View */}
                <Card className="flex-1">
                    <CardHeader>
                        <CardTitle>2025 교육과정 (전공)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {Object.entries(curriculum).map(([semester, courses]) => (
                                <div key={semester} className="mb-4">
                                    <h3 className="font-bold text-foreground mb-2 border-b border-border pb-2 text-sm uppercase tracking-wide opacity-80">{semester} 학기</h3>
                                    <div className="space-y-2">
                                        {courses.length === 0 ? <p className="text-muted-foreground text-sm italic">개설된 과목이 없습니다.</p> :
                                            courses.map(course => {
                                                const isRequiredForTrack = tracks[selectedTrack].required.includes(course.name);
                                                const isTaken = takenCourses.includes(course.name);

                                                return (
                                                    <div key={course.code} className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${isRequiredForTrack ? 'bg-orange-50/80 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900/50' : 'hover:bg-muted/50 border border-transparent'}`}>
                                                        <Checkbox
                                                            id={course.code}
                                                            checked={isTaken}
                                                            onCheckedChange={() => toggleCourse(course.name)}
                                                            className="mt-1"
                                                        />
                                                        <div className="flex-1">
                                                            <label htmlFor={course.code} className={`text-sm font-medium cursor-pointer ${isTaken ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                                                {course.name}
                                                            </label>
                                                            <div className="flex gap-2 mt-1.5 flex-wrap">
                                                                <Badge variant="secondary" className="text-[10px] px-1.5 h-5 font-normal">{course.type}</Badge>
                                                                <span className="text-[10px] text-muted-foreground flex items-center">{course.credit}학점</span>
                                                                {isRequiredForTrack && <Badge variant="outline" className="text-[10px] px-1.5 h-5 text-orange-600 border-orange-200 dark:text-orange-400 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30">필수 과목</Badge>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );

}
