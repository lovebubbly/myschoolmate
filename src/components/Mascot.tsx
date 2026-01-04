
'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

export function Mascot({ message }: { message?: string }) {
    const [hovered, setHovered] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 flex flex-col items-end z-50">
            {/* Speech Bubble */}
            {(message || hovered) && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white border shadow-lg rounded-2xl p-4 mb-2 max-w-xs text-sm font-medium text-gray-700 relative mr-4"
                >
                    {message || "오늘도 힘내세요! 필요한 정보가 있나요?"}
                    <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-b border-r transform rotate-45"></div>
                </motion.div>
            )}

            {/* Character Circle */}
            <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full shadow-xl flex items-center justify-center cursor-pointer text-white text-3xl overflow-hidden"
            >
                🤖
            </motion.div>
        </div>
    );
}
