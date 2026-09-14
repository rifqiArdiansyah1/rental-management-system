'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'

interface HeroAmbientControllerProps {
  children: ReactNode
  className?: string
  id?: string
}

export default function HeroAmbientController({
  children,
  className = '',
  id,
}: HeroAmbientControllerProps) {
  const containerRef = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(true)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !containerRef.current) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting)
      },
      {
        threshold: 0.05,
      }
    )

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <section
      id={id}
      ref={containerRef}
      data-in-view={inView ? 'true' : 'false'}
      className={className}
    >
      {children}
    </section>
  )
}
