'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Sparkles, X, MessageCircle } from 'lucide-react';

interface MascotProps {
    message?: string;
    autoHideDelay?: number;
}

const mascotEmojis = ['🤖', '✨', '🎓', '📚', '💡'];

export function Mascot({ message, autoHideDelay = 5000 }: MascotProps) {
    const [hovered, setHovered] = useState(false);
    const [showMessage, setShowMessage] = useState(!!message);
    const [currentEmoji, setCurrentEmoji] = useState('🤖');
    const [isMinimized, setIsMinimized] = useState(false);

    useEffect(() => {
        if (message) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShowMessage(true);
            const timer = setTimeout(() => setShowMessage(false), autoHideDelay);
            return () => clearTimeout(timer);
        }
    }, [message, autoHideDelay]);

    // Random emoji on hover
    const handleHover = () => {
        setHovered(true);
        setCurrentEmoji(mascotEmojis[Math.floor(Math.random() * mascotEmojis.length)]);
    };

    if (isMinimized) {
        return (
            <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 rounded-full shadow-lg flex items-center justify-center"
            >
                <MessageCircle className="w-5 h-5 text-white" />
            </motion.button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 flex flex-col items-end z-50">
            {/* Speech Bubble */}
            <AnimatePresence>
                {(showMessage || hovered) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        className="relative bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl p-4 mb-3 max-w-xs mr-2"
                    >
                        {/* Close button */}
                        <button
                            onClick={() => { setShowMessage(false); setIsMinimized(true); }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-muted rounded-full flex items-center justify-center hover:bg-muted-foreground/20 transition-colors"
                        >
                            <X className="w-3 h-3 text-muted-foreground" />
                        </button>

                        {/* AI Indicator */}
                        <div className="flex items-center gap-1.5 mb-2">
                            <motion.div
                                animate={{ rotate: [0, 15, -15, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <Sparkles className="w-4 h-4 text-purple-500" />
                            </motion.div>
                            <span className="text-[10px] font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                                AI 어시스턴트
                            </span>
                        </div>

                        <p className="text-sm font-medium text-foreground leading-relaxed">
                            {message || "안녕하세요! 오늘도 힘내세요 💪\n필요한 정보가 있으면 알려드릴게요!"}
                        </p>

                        {/* Tail */}
                        <div className="absolute -bottom-2 right-6 w-4 h-4 bg-card/95 border-b border-r border-border/50 transform rotate-45" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Character Circle */}
            <motion.div
                whileHover={{ scale: 1.1, rotate: [0, -5, 5, 0] }}
                whileTap={{ scale: 0.9 }}
                onMouseEnter={handleHover}
                onMouseLeave={() => setHovered(false)}
                onClick={() => setShowMessage(!showMessage)}
                className="relative cursor-pointer"
            >
                {/* Glow effect */}
                <motion.div
                    animate={{
                        boxShadow: [
                            "0 0 20px rgba(139, 92, 246, 0.3)",
                            "0 0 40px rgba(59, 130, 246, 0.4)",
                            "0 0 20px rgba(139, 92, 246, 0.3)"
                        ]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute inset-0 rounded-full"
                />

                {/* Main circle */}
                <motion.div
                    className="relative w-16 h-16 bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 rounded-full shadow-xl flex items-center justify-center overflow-hidden"
                >
                    {/* Shine effect */}
                    <motion.div
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                    />

                    <motion.span
                        key={currentEmoji}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="text-2xl relative z-10"
                    >
                        {currentEmoji}
                    </motion.span>
                </motion.div>

                {/* Notification dot */}
                {message && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-background"
                    />
                )}
            </motion.div>
        </div>
    );
}
