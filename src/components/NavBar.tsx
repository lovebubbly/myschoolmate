
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/ModeToggle';

export function NavBar() {
    return (
        <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 px-6 py-4 flex justify-between items-center transition-colors">
            <div className="font-bold text-xl text-foreground flex items-center gap-2">
                <Link href="/" className="hover:opacity-80 transition-opacity">
                    MySchoolMate 🏫
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
