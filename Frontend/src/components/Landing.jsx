import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import LandingBookTab from './LandingBookTab'
import { usePageSeo } from '../hooks/usePageSeo'
import { useSwipeTabs } from '../hooks/useSwipeTabs'
import { LANDING_TABS } from './landingTabs'
import './css/Landing.css'
import './css/Services.css'

const LandingSalonsTab = lazy(() => import('./LandingSalonsTab'))
const LandingFreelancersTab = lazy(() => import('./LandingFreelancersTab'))

const Landing = () => {
  usePageSeo()
  const [activeTab, setActiveTab] = useState('book')
  const tabIds = useMemo(() => LANDING_TABS.map((tab) => tab.id), [])
  const { onTouchStart, onTouchEnd, onTouchCancel } = useSwipeTabs(tabIds, activeTab, setActiveTab)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeTab])

  return (
    <div className="landing-app">
      <nav className="landing-tab-bar" role="tablist" aria-label="Home sections">
        <div className="landing-tab-bar-inner">
          {LANDING_TABS.map(({ id, label, icon }) => {
            const isActive = activeTab === id

            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`landing-tab-${id}`}
                aria-selected={isActive}
                aria-controls={`landing-panel-${id}`}
                className={`landing-tab-btn${isActive ? ' is-active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <i className={icon} aria-hidden="true" />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <p className="landing-swipe-hint" aria-hidden="true">
        <i className="fa-solid fa-hand-pointer" /> Swipe left or right to switch tabs
      </p>

      <div
        className="landing-app-panel"
        role="tabpanel"
        id={`landing-panel-${activeTab}`}
        aria-labelledby={`landing-tab-${activeTab}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      >
        {activeTab === 'book' ? (
          <LandingBookTab />
        ) : (
          <Suspense fallback={<p className="text-center text-muted py-5">Loading…</p>}>
            {activeTab === 'salons' ? <LandingSalonsTab /> : <LandingFreelancersTab />}
          </Suspense>
        )}
      </div>
    </div>
  )
}

export default Landing
