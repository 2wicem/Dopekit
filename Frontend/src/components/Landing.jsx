import { useEffect, useMemo, useState } from 'react'
import LandingBookTab from './LandingBookTab'
import LandingFreelancersTab from './LandingFreelancersTab'
import LandingSalonsTab from './LandingSalonsTab'
import { useSwipeTabs } from '../hooks/useSwipeTabs'
import { LANDING_TABS } from './landingData'
import './css/Landing.css'
import './css/Services.css'

const TAB_PANELS = {
  book: LandingBookTab,
  salons: LandingSalonsTab,
  freelancers: LandingFreelancersTab,
}

const Landing = () => {
  const [activeTab, setActiveTab] = useState('book')
  const tabIds = useMemo(() => LANDING_TABS.map((tab) => tab.id), [])
  const { onTouchStart, onTouchEnd, onTouchCancel } = useSwipeTabs(tabIds, activeTab, setActiveTab)
  const ActivePanel = TAB_PANELS[activeTab]

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
        <ActivePanel />
      </div>
    </div>
  )
}

export default Landing
