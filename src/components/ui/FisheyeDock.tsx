'use client'

import React, { useRef, useEffect, useCallback } from 'react'

/**
 * useVerticalFisheyeDock
 * Bencho / macOS Fisheye Physics Hook:
 * Sets --d (item distance from cursor) and --f (raised cosine factor)
 * directly on DOM nodes in requestAnimationFrame for ultra-fluid 120fps
 * hardware-accelerated animations with zero React re-render overhead.
 */
export function useVerticalFisheyeDock(reach: number = 2.8) {
  const containerRef = useRef<HTMLElement | null>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  const rafId = useRef<number | null>(null)

  const registerItem = useCallback((index: number) => (el: HTMLElement | null) => {
    itemRefs.current[index] = el
    if (el) {
      el.style.setProperty('--d', '999')
      el.style.setProperty('--f', '0')
    }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (rafId.current) cancelAnimationFrame(rafId.current)
    const mouseY = e.clientY

    rafId.current = requestAnimationFrame(() => {
      itemRefs.current.forEach((item) => {
        if (!item) return
        const rect = item.getBoundingClientRect()
        const centerY = rect.top + rect.height / 2
        const h = rect.height || 48
        const d = Math.abs(mouseY - centerY) / h

        if (d >= reach) {
          item.style.setProperty('--d', '999')
          item.style.setProperty('--f', '0')
        } else {
          item.style.setProperty('--d', d.toFixed(3))
          const f = Math.max(0, (1 + Math.cos((Math.PI * d) / reach)) / 2)
          item.style.setProperty('--f', f.toFixed(3))
        }
      })
    })
  }, [reach])

  const onMouseLeave = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(() => {
      itemRefs.current.forEach((item) => {
        if (!item) return
        item.style.setProperty('--d', '999')
        item.style.setProperty('--f', '0')
      })
    })
  }, [])

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  return {
    containerRef,
    registerItem,
    onMouseMove,
    onMouseLeave,
  }
}
