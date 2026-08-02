import { useEffect, useState } from 'react'

export const useHeroCarousel = (slideCount, intervalMs = 2000) => {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (slideCount <= 1) {
      return undefined
    }

    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % slideCount)
    }, intervalMs)

    return () => clearInterval(timer)
  }, [slideCount, intervalMs])

  return activeIndex
}
