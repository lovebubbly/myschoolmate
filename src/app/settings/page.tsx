'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getProviders, signIn, signOut, useSession } from 'next-auth/react';

interface Track {
    id: number;
    name: string;
}

export default function Settings() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [grade, setGrade] = useState('1');
    const [income, setIncome] = useState('10');
    const [gpa, setGpa] = useState('0.0');
    const [trackId, setTrackId] = useState<string>('');
    const [notificationEmail, setNotificationEmail] = useState('');
    const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(false);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [saving, setSaving] = useState(false);
    const [switchingSession, setSwitchingSession] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);
    const [sendingDigest, setSendingDigest] = useState(false);
    const [mailStatus, setMailStatus] = useState<string | null>(null);
    const [authProviders, setAuthProviders] = useState<Array<{ id: string; name: string }>>([]);
    const [providersReady, setProvidersReady] = useState(false);

    async function fetchTracks() {
        const res = await fetch('/api/curriculum');
        const data = await res.json();
        if (data.success) setTracks(data.tracks);
    }

    async function fetchProfile() {
        const res = await fetch('/api/user/profile', { cache: 'no-store' });
        const data = await res.json();
        if (data.success && data.profile) {
            setGrade(String(data.profile.grade));
            setIncome(String(data.profile.income));
            setGpa(String(data.profile.gpa || '0.0'));
            setTrackId(String(data.profile.trackId || ''));
            setNotificationEmail(String(data.profile.notificationEmail || data.profile.email || ''));
            setEmailAlertsEnabled(Boolean(data.profile.emailAlertsEnabled));
        }
    }

    async function fetchAuthProviders() {
        try {
            const providers = await getProviders();
            const entries = providers ? Object.values(providers).map((provider) => ({
                id: provider.id,
                name: provider.name,
            })) : [];
            setAuthProviders(entries);
        } catch (e) {
            console.error('Failed to fetch auth providers:', e);
            setAuthProviders([]);
        }
        setProvidersReady(true);
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchTracks();
        void fetchProfile();
        void fetchAuthProviders();
    }, []);

    const handleSave = async () => {
        const normalizedEmail = notificationEmail.trim().toLowerCase();
        if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            alert('올바른 이메일 형식을 입력해주세요.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                grade: parseInt(grade),
                income: parseInt(income),
                gpa: parseFloat(gpa),
                trackId: trackId ? parseInt(trackId) : null,
                notificationEmail: normalizedEmail || null,
                emailAlertsEnabled
            };
            console.log('Sending payload:', payload);

            const res = await fetch('/api/user/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                console.log('Save success:', data);
                setMailStatus('설정이 저장되었습니다.');
                router.refresh(); // Refresh server data
                router.push('/');
            } else {
                const err = await res.text();
                console.error('Save failed:', err);
                alert('저장에 실패했습니다. 다시 시도해주세요.');
            }
        } catch (e) {
            console.error('Failed to save profile:', e);
            alert('저장 중 오류가 발생했습니다.');
        }
        setSaving(false);
    };

    const handleStartNewSession = async () => {
        setSwitchingSession(true);
        try {
            const res = await fetch('/api/user/session', { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.success && data.profile) {
                setGrade(String(data.profile.grade));
                setIncome(String(data.profile.income));
                setGpa(String(data.profile.gpa || '0.0'));
                setTrackId(String(data.profile.trackId || ''));
                setNotificationEmail(String(data.profile.notificationEmail || data.profile.email || ''));
                setEmailAlertsEnabled(Boolean(data.profile.emailAlertsEnabled));
                router.refresh();
                router.push('/');
            } else {
                alert('새 사용자 세션 생성에 실패했습니다.');
            }
        } catch (e) {
            console.error('Failed to start new session:', e);
            alert('세션 전환 중 오류가 발생했습니다.');
        }
        setSwitchingSession(false);
    };

    const handleSendTestEmail = async () => {
        setTestingEmail(true);
        setMailStatus(null);
        try {
            const res = await fetch('/api/alerts/email/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: notificationEmail.trim() || null }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (data.mode === 'smtp') {
                    setMailStatus(`테스트 메일 발송 완료: ${data.to}`);
                } else {
                    setMailStatus('SMTP 미설정 상태입니다. 현재는 dry-run으로 확인되었습니다.');
                }
            } else {
                setMailStatus(data.error || '테스트 메일 발송에 실패했습니다.');
            }
        } catch (e) {
            console.error('Failed to send test email:', e);
            setMailStatus('테스트 메일 발송 중 오류가 발생했습니다.');
        }
        setTestingEmail(false);
    };

    const handleSendDigest = async () => {
        setSendingDigest(true);
        setMailStatus(null);
        try {
            const res = await fetch('/api/alerts/email/digest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: 'me', force: true }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const sent = data.summary?.sent ?? 0;
                const dryRun = data.summary?.dryRun ?? 0;
                if (sent > 0) {
                    setMailStatus('오늘 브리핑 메일 발송이 완료되었습니다.');
                } else if (dryRun > 0) {
                    setMailStatus('SMTP 미설정 상태입니다. 오늘 브리핑 메일 dry-run만 수행되었습니다.');
                } else {
                    setMailStatus('발송 대상이 없거나 메일 설정이 비활성화되어 있습니다.');
                }
            } else {
                setMailStatus(data.error || '오늘 브리핑 메일 발송에 실패했습니다.');
            }
        } catch (e) {
            console.error('Failed to send digest email:', e);
            setMailStatus('오늘 브리핑 메일 발송 중 오류가 발생했습니다.');
        }
        setSendingDigest(false);
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 pt-[120px] md:pt-[120px] font-sans text-foreground flex flex-col items-center">
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
                            <option value="10">10구간</option>
                            <option value="9">9구간</option>
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

                    <div className="space-y-3 rounded-xl border border-border p-4 bg-muted/20">
                        <p className="text-sm font-bold text-muted-foreground">메일 알림</p>
                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground">알림 수신 이메일</label>
                            <input
                                type="email"
                                className="w-full bg-background p-3 rounded-xl font-medium focus:ring-2 focus:ring-primary/20 outline-none border border-border"
                                placeholder="you@example.com"
                                value={notificationEmail}
                                onChange={(e) => setNotificationEmail(e.target.value)}
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                            <input
                                type="checkbox"
                                checked={emailAlertsEnabled}
                                onChange={(e) => setEmailAlertsEnabled(e.target.checked)}
                                className="h-4 w-4 rounded border-border"
                            />
                            신규 브리핑 메일 알림 받기
                        </label>
                        <div className="flex flex-col gap-2 md:flex-row">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleSendTestEmail}
                                disabled={testingEmail || !notificationEmail.trim()}
                                className="h-10 rounded-xl"
                            >
                                {testingEmail ? '테스트 중...' : '테스트 메일 보내기'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleSendDigest}
                                disabled={sendingDigest || !emailAlertsEnabled || !notificationEmail.trim()}
                                className="h-10 rounded-xl"
                            >
                                {sendingDigest ? '발송 중...' : '오늘 브리핑 메일 보내기'}
                            </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            SMTP 키가 없으면 테스트/발송은 dry-run으로 동작합니다.
                        </p>
                        {mailStatus && (
                            <p className="text-xs font-medium text-primary">
                                {mailStatus}
                            </p>
                        )}
                    </div>

                    <Button
                        size="lg"
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full h-14 rounded-[20px] text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                    >
                        {saving ? '저장 중...' : '저장하기'}
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={handleStartNewSession}
                        disabled={switchingSession || status === 'authenticated'}
                        className="w-full h-12 rounded-[16px] text-sm font-bold"
                    >
                        {switchingSession ? '전환 중...' : status === 'authenticated' ? '소셜 로그인 사용 중' : '새 사용자 세션 시작'}
                    </Button>
                    <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-3">
                        <p className="text-sm font-bold">
                            {status === 'authenticated' ? '소셜 로그인 연결됨' : '소셜 로그인'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {status === 'authenticated'
                                ? `${session?.user?.email || '계정 정보 없음'} 계정으로 로그인되어 있습니다.`
                                : authProviders.length > 0
                                    ? 'Google/GitHub 로그인으로 사용자 프로필을 기기 간 동기화할 수 있습니다.'
                                    : '현재는 익명 모드로 동작합니다. API 키 설정 후 소셜 로그인을 사용할 수 있습니다.'}
                        </p>
                        <div className="flex gap-2">
                            {status === 'authenticated' ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => signOut({ callbackUrl: '/settings' })}
                                    className="h-9 rounded-lg"
                                >
                                    로그아웃
                                </Button>
                            ) : (
                                authProviders.length > 0 ? (
                                    authProviders.map((provider) => (
                                        <Button
                                            key={provider.id}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => signIn(provider.id, { callbackUrl: '/settings' })}
                                            className="h-9 rounded-lg"
                                        >
                                            {provider.name} 로그인
                                        </Button>
                                    ))
                                ) : (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled
                                        className="h-9 rounded-lg"
                                    >
                                        {providersReady ? '소셜 로그인 준비중' : '로그인 설정 확인중'}
                                    </Button>
                                )
                            )}
                        </div>
                    </div>
                    <p className="text-center text-xs text-muted-foreground mt-4 leading-relaxed bg-muted/30 p-3 rounded-xl">
                        🔒 입력하신 정보는 <b>현재 브라우저</b>에 안전하게 저장되어 재방문 시에도 유지되며, <b>공지사항 필터링</b> 목적으로만 사용됩니다.<br />
                        (단, AI 브리핑 생성을 위해 익명화된 정보가 Gemini 서버로 전송될 수 있습니다)
                    </p>
                </Card>
            </main>
        </div>
    );
}
