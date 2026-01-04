
import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CalendarIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';

interface NoticeProps {
    id: number;
    title: string;
    date: string;
    category: string;
    url: string;
    minGrade?: number | null;
    maxIncome?: number | null;
    minGpa?: number | null;
    isImportant?: boolean; // If nudge logic deems it important
}

export function NoticeCard({ notice }: { notice: NoticeProps }) {
    // Determine color based on category
    const categoryColor = notice.category === 'Academic' ? 'bg-blue-100 text-blue-800'
        : notice.category === 'Scholarship' ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800';

    return (
        <Link href={notice.url} target="_blank">
            <Card className={cn("hover:shadow-lg transition-all duration-300 cursor-pointer border-l-4",
                notice.category === 'Academic' ? "border-l-blue-500" : "border-l-green-500"
            )}>
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <Badge variant="secondary" className={categoryColor}>{notice.category}</Badge>
                        {notice.isImportant && <Badge variant="destructive" className="animate-pulse">Recommended</Badge>}
                    </div>
                    <CardTitle className="text-lg font-bold line-clamp-2 mt-2 leading-tight">
                        {notice.title}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2 mt-2">
                        {notice.minGrade && <Badge variant="outline">{notice.minGrade}학년↑</Badge>}
                        {notice.maxIncome && <Badge variant="outline">소득{notice.maxIncome}구간↓</Badge>}
                    </div>
                </CardContent>
                <CardFooter className="text-sm text-gray-500 flex items-center gap-4 pt-0">
                    <div className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        {notice.date}
                    </div>
                </CardFooter>
            </Card>
        </Link>
    );
}
