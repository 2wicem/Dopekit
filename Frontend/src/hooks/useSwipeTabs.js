import { useCallback, useRef } from 'react'

const SWIPE_THRESHOLD_PX = 56
const SWIPE_AXIS_RATIO = 1.25

export const useSwipeTabs = (tabIds, activeTab, setActiveTab) => {
  const touchStart = useRef(null)

  const goToAdjacentTab = useCallback(
    (direction) => {
      const currentIndex = tabIds.indexOf(activeTab)
      if (currentIndex === -1) {
        return
      }

      const nextIndex = currentIndex + direction
      if (nextIndex >= 0 && nextIndex < tabIds.length) {
        setActiveTab(tabIds[nextIndex])
      }
    },
    [activeTab, setActiveTab, tabIds]
  )

  const onTouchStart = useCallback((event) => {
    const touch = event.touches[0]
    if (!touch) {
      return
    }

    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
    }
  }, [])

  const onTouchEnd = useCallback(
    (event) => {
      if (!touchStart.current) {
        return
      }

      const touch = event.changedTouches[0]
      if (!touch) {
        touchStart.current = null
        return
      }

      const deltaX = touch.clientX - touchStart.current.x
      const deltaY = touch.clientY - touchStart.current.y
      touchStart.current = null

      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) {
        return
      }

      if (Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_AXIS_RATIO) {
        return
      }

      if (deltaX < 0) {
        goToAdjacentTab(1)
        return
      }

      goToAdjacentTab(-1)
    },
    [goToAdjacentTab]
  )

  const onTouchCancel = useCallback(() => {
    touchStart.current = null
  }, [])

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
  }
}
