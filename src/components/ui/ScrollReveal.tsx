'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'

interface ScrollRevealProps {
  children: ReactNode
  className?: string
  delay?: number
}

export default function ScrollReveal({
  children,
  className = '',
  delay = 0,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  // Progressive enhancement: start visible for SSR & No-JS fallback
  const [isRevealed, setIsRevealed] = useState(true)
  const [isClientReady, setIsClientReady] = useState(false)

  useEffect(() => {
    // If IntersectionObserver is not supported, remain visible
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined' || !ref.current) {
      return
    }

    // Client is ready and observer is supported: engage transition state
    setIsRevealed(false)
    setIsClientReady(true)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true)
          observer.disconnect()
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    )

    observer.observe(ref.current)

    // Safety timeout fallback: if observer does not trigger within 600ms, reveal anyway
    const safetyTimer = setTimeout(() => {
      setIsRevealed(true)
    }, 600)

    return () => {
      observer.disconnect()
      clearTimeout(safetyTimer)
    }
  }, [])

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: isClientReady ? `${delay}ms` : '0ms',
      }}
      className={`${className} ${
        isClientReady
          ? isRevealed
            ? 'opacity-100 translate-y-0 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]'
            : 'opacity-0 translate-y-6 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]'
          : ''
      }`}
    >
      {children}
    </div>
  )
}
