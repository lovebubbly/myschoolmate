'use client';

import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

// Inline animation data for loading spinner (simple dots)
const loadingDotsAnimation = {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 40,
    nm: "Loading Dots",
    ddd: 0,
    assets: [],
    layers: [
        {
            ddd: 0,
            ind: 1,
            ty: 4,
            nm: "Dot 1",
            sr: 1,
            ks: {
                o: { a: 1, k: [{ t: 0, s: [30], e: [100] }, { t: 15, s: [100], e: [30] }, { t: 30, s: [30] }] },
                p: { a: 0, k: [25, 20, 0] },
                s: { a: 1, k: [{ t: 0, s: [80, 80, 100], e: [100, 100, 100] }, { t: 15, s: [100, 100, 100], e: [80, 80, 100] }, { t: 30, s: [80, 80, 100] }] }
            },
            shapes: [{
                ty: "el",
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [12, 12] }
            }, {
                ty: "fl",
                c: { a: 0, k: [0.19, 0.51, 0.96, 1] }
            }]
        },
        {
            ddd: 0,
            ind: 2,
            ty: 4,
            nm: "Dot 2",
            sr: 1,
            ks: {
                o: { a: 1, k: [{ t: 10, s: [30], e: [100] }, { t: 25, s: [100], e: [30] }, { t: 40, s: [30] }] },
                p: { a: 0, k: [50, 20, 0] },
                s: { a: 1, k: [{ t: 10, s: [80, 80, 100], e: [100, 100, 100] }, { t: 25, s: [100, 100, 100], e: [80, 80, 100] }, { t: 40, s: [80, 80, 100] }] }
            },
            shapes: [{
                ty: "el",
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [12, 12] }
            }, {
                ty: "fl",
                c: { a: 0, k: [0.55, 0.36, 0.96, 1] }
            }]
        },
        {
            ddd: 0,
            ind: 3,
            ty: 4,
            nm: "Dot 3",
            sr: 1,
            ks: {
                o: { a: 1, k: [{ t: 20, s: [30], e: [100] }, { t: 35, s: [100], e: [30] }, { t: 50, s: [30] }] },
                p: { a: 0, k: [75, 20, 0] },
                s: { a: 1, k: [{ t: 20, s: [80, 80, 100], e: [100, 100, 100] }, { t: 35, s: [100, 100, 100], e: [80, 80, 100] }, { t: 50, s: [80, 80, 100] }] }
            },
            shapes: [{
                ty: "el",
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [12, 12] }
            }, {
                ty: "fl",
                c: { a: 0, k: [0.96, 0.23, 0.19, 1] }
            }]
        }
    ]
};

// Success checkmark animation
const successAnimation = {
    v: "5.7.4",
    fr: 60,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: "Success",
    ddd: 0,
    assets: [],
    layers: [
        {
            ddd: 0,
            ind: 1,
            ty: 4,
            nm: "Check",
            sr: 1,
            ks: {
                o: { a: 0, k: 100 },
                p: { a: 0, k: [50, 50, 0] },
                s: { a: 1, k: [{ t: 0, s: [0, 0, 100], e: [110, 110, 100] }, { t: 20, s: [110, 110, 100], e: [100, 100, 100] }, { t: 30, s: [100, 100, 100] }] }
            },
            shapes: [{
                ty: "gr",
                it: [
                    {
                        ty: "sh",
                        ks: {
                            a: 0,
                            k: {
                                c: false,
                                v: [[-15, 0], [-5, 10], [15, -10]],
                                i: [[0, 0], [0, 0], [0, 0]],
                                o: [[0, 0], [0, 0], [0, 0]]
                            }
                        }
                    },
                    {
                        ty: "st",
                        c: { a: 0, k: [0.2, 0.8, 0.4, 1] },
                        w: { a: 0, k: 6 },
                        lc: 2,
                        lj: 2
                    },
                    {
                        ty: "tm",
                        s: { a: 0, k: 0 },
                        e: { a: 1, k: [{ t: 15, s: [0], e: [100] }, { t: 40, s: [100] }] }
                    },
                    { ty: "tr", p: { a: 0, k: [0, 0] } }
                ]
            }]
        },
        {
            ddd: 0,
            ind: 2,
            ty: 4,
            nm: "Circle",
            sr: 1,
            ks: {
                o: { a: 0, k: 100 },
                p: { a: 0, k: [50, 50, 0] },
                s: { a: 1, k: [{ t: 0, s: [0, 0, 100], e: [110, 110, 100] }, { t: 15, s: [110, 110, 100], e: [100, 100, 100] }, { t: 25, s: [100, 100, 100] }] }
            },
            shapes: [{
                ty: "el",
                p: { a: 0, k: [0, 0] },
                s: { a: 0, k: [60, 60] }
            }, {
                ty: "st",
                c: { a: 0, k: [0.2, 0.8, 0.4, 1] },
                w: { a: 0, k: 4 }
            }]
        }
    ]
};

interface LottieLoaderProps {
    size?: number;
    className?: string;
}

export function LottieLoader({ size = 80, className = '' }: LottieLoaderProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`flex items-center justify-center ${className}`}
        >
            <Lottie
                animationData={loadingDotsAnimation}
                loop
                style={{ width: size, height: size * 0.4 }}
            />
        </motion.div>
    );
}

interface LottieSuccessProps {
    size?: number;
    className?: string;
    onComplete?: () => void;
}

export function LottieSuccess({ size = 60, className = '', onComplete }: LottieSuccessProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex items-center justify-center ${className}`}
        >
            <Lottie
                animationData={successAnimation}
                loop={false}
                style={{ width: size, height: size }}
                onComplete={onComplete}
            />
        </motion.div>
    );
}

// AI 분석 중 애니메이션을 위한 컴포넌트
export function AIAnalyzingLoader({ message = "AI가 분석 중입니다..." }: { message?: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center py-8 gap-4"
        >
            <div className="relative">
                <motion.div
                    animate={{
                        boxShadow: [
                            "0 0 20px rgba(49, 130, 246, 0.3)",
                            "0 0 40px rgba(139, 92, 246, 0.4)",
                            "0 0 20px rgba(49, 130, 246, 0.3)"
                        ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center"
                >
                    <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="text-2xl"
                    >
                        ✨
                    </motion.span>
                </motion.div>
            </div>

            <div className="flex flex-col items-center gap-2">
                <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-sm font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent"
                >
                    {message}
                </motion.span>
                <LottieLoader size={60} />
            </div>
        </motion.div>
    );
}
