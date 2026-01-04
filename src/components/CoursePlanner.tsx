
'use client';

import React, { useState, useEffect } from 'react';
import curriculumData from '@/lib/curriculum.json';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Type definitions
type Course = { code: string; name: string; type: string; credit: number; };
type SemesterData = Record<string, Course[]>;
type TrackData = { name: string; required: string[]; };

export default function CoursePlanner() {
    const [takenCourses, setTakenCourses] = useState<string[]>([]);
    const [selectedTrack, setSelectedTrack] = useState<string>('info_net');

    const curriculum = curriculumData['2025'] as SemesterData;
    const tracks = curriculumData['tracks'] as Record<string, TrackData>;

    useEffect(() => {
        const saved = localStorage.getItem('myschoolmate-taken');
        if (saved) setTakenCourses(JSON.parse(saved));
    }, []);

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
                        <CardTitle>🎓 Graduation Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {Object.entries(tracks).map(([key, track]) => {
                            const progress = calculateProgress(key);
                            const isSelected = selectedTrack === key;
                            return (
                                <div
                                    key={key}
                                    className={`p-3 rounded-lg cursor-pointer transition-colors border ${isSelected ? 'bg-indigo-50 border-indigo-200' : 'bg-white hover:bg-gray-50'}`}
                                    onClick={() => setSelectedTrack(key)}
                                >
                                    <div className="flex justify-between mb-2">
                                        <span className="font-semibold text-sm">{track.name}</span>
                                        <span className="text-xs text-gray-500">{Math.round(progress)}%</span>
                                    </div>
                                    <Progress value={progress} className={isSelected ? "bg-indigo-200" : "bg-gray-100"} />
                                </div>
                            );
                        })}

                        <div className="text-xs text-gray-500 mt-4">
                            * Select a track to highlight required courses.
                        </div>
                    </CardContent>
                </Card>

                {/* Main Curriculum View */}
                <Card className="flex-1">
                    <CardHeader>
                        <CardTitle>2025 Education Curriculum</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {Object.entries(curriculum).map(([semester, courses]) => (
                                <div key={semester} className="mb-4">
                                    <h3 className="font-bold text-gray-700 mb-2 border-b pb-1">{semester} Semester</h3>
                                    <div className="space-y-2">
                                        {courses.length === 0 ? <p className="text-gray-300 text-sm">No courses listed</p> :
                                            courses.map(course => {
                                                const isRequiredForTrack = tracks[selectedTrack].required.includes(course.name);
                                                const isTaken = takenCourses.includes(course.name);

                                                return (
                                                    <div key={course.code} className={`flex items-start gap-2 p-2 rounded ${isRequiredForTrack ? 'bg-yellow-50' : ''}`}>
                                                        <Checkbox
                                                            id={course.code}
                                                            checked={isTaken}
                                                            onCheckedChange={() => toggleCourse(course.name)}
                                                        />
                                                        <div className="flex-1">
                                                            <label htmlFor={course.code} className={`text-sm font-medium ${isTaken ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                                                {course.name}
                                                            </label>
                                                            <div className="flex gap-1 mt-1">
                                                                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{course.type}</Badge>
                                                                <span className="text-[10px] text-gray-500">{course.credit} Credits</span>
                                                                {isRequiredForTrack && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-amber-600 border-amber-200">Track Required</Badge>}
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
