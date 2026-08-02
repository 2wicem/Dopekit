import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { apiFetch } from '../config/api'
import OwnerSalonsPanel from './OwnerSalonsPanel'
import OwnerTechniciansPanel from './OwnerTechniciansPanel'
import './css/Dashboard.css'
import './css/AdminShell.css'
import './css/OwnerPanel.css'

const SALONS_PATH = '/products/owner/salons/'

const TABS = [
  { id: 'branches', label: 'Branches' },
  { id: 'technicians', label: 'Technicians' },
]

const OwnerPanel = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('branches')
  const [salons, setSalons] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadSalons = useCallback(async () => {
    const response = await apiFetch(SALONS_PATH)
    const text = await response.text()
    const data = text ? JSON.parse(text) : {}
    if (!response.ok) {
      throw new Error(data.error || 'Could not load branches.')
    }
    setSalons(data.salons || [])
    return data.salons || []
  }, [])

  useEffect(() => {
    setLoading(true)
    loadSalons()
      .catch((error) => setStatus({ type: 'error', message: error.message }))
      .finally(() => setLoading(false))
  }, [loadSalons])

  const handleSalonsChanged = async () => {
    await loadSalons()
  }

  return (
    <div className="admin-shell owner-shell">
      <header className="admin-shell-header">
        <div>
          <p className="admin-shell-eyebrow">Salon owner</p>
          <h1 className="admin-shell-title">My salons</h1>
          <p className="admin-shell-lead">
            Manage branches, locations, and technicians for {user?.name || 'your business'}.
          </p>
        </div>
        <Link to="/" className="btn btn-sm btn-outline-secondary">
          Back to site
        </Link>
      </header>

      {status && (
        <div className={`alert ${status.type === 'error' ? 'alert-danger' : 'alert-success'}`} role="status">
          {status.message}
        </div>
      )}

      <nav className="admin-tab-bar" aria-label="Owner sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`admin-tab${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="admin-shell-main">
        {loading ? (
          <p className="text-muted dashboard-empty">Loading…</p>
        ) : activeTab === 'branches' ? (
          <OwnerSalonsPanel salons={salons} onChanged={handleSalonsChanged} onStatus={setStatus} />
        ) : (
          <OwnerTechniciansPanel salons={salons} onStatus={setStatus} />
        )}
      </main>
    </div>
  )
}

export default OwnerPanel
