import { useState, useEffect, useRef, useCallback } from 'react'

interface ScrollSpyOptions {
  /** Offset from top of viewport to trigger section change */
  offset?: number
  /** Root element to observe scroll (defaults to document) */
  root?: HTMLElement | null
}

/**
 * Hook to track which section is currently in view during scroll
 */
export function useScrollSpy(
  sectionIds: string[],
  options: ScrollSpyOptions = {}
) {
  const { offset = 100 } = options
  const [activeId, setActiveId] = useState<string>(sectionIds[0] || '')
  const observer = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const elements = sectionIds
      .map(id => document.getElementById(id))
      .filter(Boolean) as HTMLElement[]

    if (elements.length === 0) return

    // Disconnect previous observer
    observer.current?.disconnect()

    // Track which sections are visible
    const visibleSections = new Map<string, number>()

    observer.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.intersectionRatio)
          } else {
            visibleSections.delete(entry.target.id)
          }
        })

        // Find the topmost visible section
        if (visibleSections.size > 0) {
          // Get visible sections sorted by their position in the DOM
          const sortedVisible = sectionIds.filter(id => visibleSections.has(id))
          if (sortedVisible.length > 0) {
            setActiveId(sortedVisible[0])
          }
        }
      },
      {
        rootMargin: `-${offset}px 0px -50% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    )

    elements.forEach(el => observer.current?.observe(el))

    return () => observer.current?.disconnect()
  }, [sectionIds, offset])

  const scrollTo = useCallback((id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const top = element.offsetTop - offset + 20
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }, [offset])

  return { activeId, scrollTo }
}

