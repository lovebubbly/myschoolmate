
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function NavBar() {
    return (
        <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-10 px-6 py-3 flex justify-between items-center">
            <div className="font-bold text-lg text-indigo-600">
                <Link href="/">MySchoolMate 🏫</Link>
            </div>
            <div className="flex gap-4">
                <Link href="/">
                    <Button variant="ghost">Dashboard</Button>
                </Link>
                <Link href="/planning">
                    <Button variant="ghost">Planning</Button>
                </Link>
                <Link href="/settings">
                    <Button variant="ghost">Settings</Button>
                </Link>
            </div>
        </nav>
    );
}
