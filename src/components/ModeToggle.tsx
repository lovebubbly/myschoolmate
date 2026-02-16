"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ModeToggleProps = {
  className?: string
}

export function ModeToggle({ className }: ModeToggleProps) {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [isTransitioning, setIsTransitioning] = React.useState(false)
  const transitionRef = React.useRef<number | null>(null)
  const THEME_TRANSITION_MS = 320
  const THEME_TRANSITION_EASING = [0.18, 0.89, 0.33, 1] as const

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    return () => {
      if (transitionRef.current !== null) {
        window.clearTimeout(transitionRef.current)
      }
      document.documentElement.classList.remove("theme-transition")
    }
  }, [])

  const isDark = resolvedTheme === "dark"

  const toggleTheme = React.useCallback(() => {
    if (isTransitioning) {
      return
    }

    const nextTheme = isDark ? "light" : "dark"
    const root = document.documentElement
    setTheme(nextTheme)
    setIsTransitioning(true)

    if (transitionRef.current !== null) {
      window.clearTimeout(transitionRef.current)
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("theme-transition")
        transitionRef.current = window.setTimeout(() => {
          root.classList.remove("theme-transition")
          setIsTransitioning(false)
          transitionRef.current = null
        }, THEME_TRANSITION_MS)
      })
    })
  }, [isDark, isTransitioning, setTheme])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn("relative overflow-hidden rounded-full", className)}
      >
        <span className="sr-only">Toggle theme</span>
      </Button>
    )
  }

  const motionDuration = THEME_TRANSITION_MS / 1000

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => {
        toggleTheme()
        e.currentTarget.blur()
      }}
      onMouseDown={(e) => e.currentTarget.blur()}
      aria-label="테마 전환"
      className={cn(
        "relative overflow-hidden rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors h-9 w-9",
        className,
      )}
      style={{
        transitionDuration: `${THEME_TRANSITION_MS}ms`,
        transitionTimingFunction: `cubic-bezier(${THEME_TRANSITION_EASING.join(", ")})`,
      }}
    >
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-primary/15"
        key={isDark ? "theme-ripple-dark" : "theme-ripple-light"}
        initial={{ scale: 0.25, opacity: 0.02 }}
        animate={{ scale: 1.9, opacity: 0.45 }}
        exit={{ scale: 1.95, opacity: 0.02 }}
        transition={{ duration: motionDuration, ease: THEME_TRANSITION_EASING }}
      />
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.div
            key="moon"
            initial={{ rotate: -24, opacity: 0, scale: 0.74 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -24, opacity: 0, scale: 0.74 }}
            transition={{ duration: motionDuration, ease: THEME_TRANSITION_EASING }}
            className="absolute"
          >
            <Moon className="h-[1.2rem] w-[1.2rem] text-sky-300" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ rotate: 24, opacity: 0, scale: 0.74 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 24, opacity: 0, scale: 0.74 }}
            transition={{ duration: motionDuration, ease: THEME_TRANSITION_EASING }}
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
