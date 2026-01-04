"use client"

import { motion } from "framer-motion";

export function LoadingOverlay({ message = "AI가 공지사항을 분석하고 있어요..." }: { message?: string }) {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md transition-all duration-500">
            <div className="relative">
                {/* Outer Ring */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary"
                />

                {/* Inner Pulse */}
                <motion.div
                    animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 bg-primary/10 rounded-full blur-xl"
                />
            </div>

            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-6 text-lg font-bold text-foreground flex items-center gap-2"
            >
                <span className="text-2xl">✨</span>
                {message}
            </motion.p>
        </div>
    );
}

export function ButtonLoader() {
    return (
        <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground mr-2"
        />
    )
}
