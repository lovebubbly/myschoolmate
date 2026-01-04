
import CoursePlanner from '@/components/CoursePlanner';

export default function PlanningPage() {
    return (
        <main className="min-h-screen bg-slate-50 p-4 md:p-8">
            <section className="max-w-6xl mx-auto space-y-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800">Academic Planning 📅</h1>
                    <p className="text-slate-500">Track your progress and manage graduation requirements.</p>
                </div>
                <CoursePlanner />
            </section>
        </main>
    );
}
