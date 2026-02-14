"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"

export function ModeToggle() {
    const { setTheme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)
    const [isTransitioning, setIsTransitioning] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    const isDark = resolvedTheme === "dark"

    const toggleTheme = React.useCallback(() => {
        if (isTransitioning) {
            return
        }

        const root = document.documentElement
        root.classList.add('theme-transition')
        setIsTransitioning(true)

        setTheme(isDark ? "light" : "dark")

        window.setTimeout(() => {
            root.classList.remove('theme-transition')
            setIsTransitioning(false)
        }, 250)
    }, [isDark, isTransitioning])

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="relative overflow-hidden rounded-full">
                <span className="sr-only">Toggle theme</span>
            </Button>
        )
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="테마 전환"
            className="relative overflow-hidden rounded-full hover:bg-muted/80 h-9 w-9 transition-colors duration-200"
        >
            <AnimatePresence mode="wait" initial={false}>
                {isDark ? (
                    <motion.div
                        key="moon"
                        initial={{ scale: 0.75, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={{ scale: 0.75, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute"
                    >
                        <Moon className="h-[1.2rem] w-[1.2rem] text-sky-300" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="sun"
                        initial={{ scale: 0.75, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={{ scale: 0.75, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute"
                    >
                        <Sun className="h-[1.2rem] w-[1.2rem] text-amber-500" />
                    </motion.div>
                )}
            </AnimatePresence>
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}
