"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"

import { Button } from "@/components/ui/button"

export function ModeToggle() {
    const { theme, setTheme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    const isDark = resolvedTheme === "dark"

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
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="relative overflow-hidden rounded-full hover:bg-muted/80 h-9 w-9"
        >
            <AnimatePresence mode="wait" initial={false}>
                {isDark ? (
                    <motion.div
                        key="moon"
                        initial={{ rotate: -90, scale: 0, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={{ rotate: 90, scale: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute"
                    >
                        <Moon className="h-[1.2rem] w-[1.2rem] text-yellow-300" />
                    </motion.div>
                ) : (
                    <motion.div
                        key="sun"
                        initial={{ rotate: 90, scale: 0, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={{ rotate: -90, scale: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute"
                    >
                        <Sun className="h-[1.2rem] w-[1.2rem] text-orange-500" />
                    </motion.div>
                )}
            </AnimatePresence>
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}
