import Bookservice from './Bookservice'
import BrandLogo from './BrandLogo'
import { useCallback, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ROLE_LABELS } from '../constants/roles'
import { useAuth } from '../context/useAuth'

const Navbar = () => {
  const { user, logout, loading, refreshUser } = useAuth()
  const location = useLocation()

  useEffect(() => {
    refreshUser({ silent: true })
  }, [location.pathname, refreshUser])

  const navLinkClass = (path) =>
    `nav-link site-nav-link${location.pathname === path ? ' active' : ''}`

  const closeMobileNav = useCallback(() => {
    if (window.matchMedia('(min-width: 992px)').matches) {
      return
    }

    const menu = document.getElementById('navbarNav')
    const toggler = document.querySelector('.site-nav-toggler')
    if (!menu?.classList.contains('show')) {
      return
    }

    const { Collapse } = window.bootstrap || {}
    if (Collapse) {
      const instance = Collapse.getInstance(menu) || Collapse.getOrCreateInstance(menu, { toggle: false })
      instance.hide()
    } else {
      menu.classList.remove('show')
    }

    toggler?.setAttribute('aria-expanded', 'false')
  }, [])

  useEffect(() => {
    closeMobileNav()
  }, [location.pathname, closeMobileNav])

  const handleNavClick = () => {
    closeMobileNav()
  }

  const handleLogout = async () => {
    closeMobileNav()
    try {
      await logout()
    } catch {
      // Session may already be cleared
    }
  }

  const displayName = user?.name?.trim() || 'Guest'
  const firstName = displayName.split(' ')[0]

  const tagline = user
    ? `Welcome back, ${firstName} — your go-to place for stunning nail designs...`
    : 'Welcome to your go-to place for stunning nail designs...'

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark site-navbar" data-bs-theme="dark">
        <div className="container-fluid">
          <div className="d-flex align-items-center gap-2 navbar-brand-wrap">
            <Link className="navbar-brand mb-0" to="/" onClick={handleNavClick}>
              <BrandLogo size="md" />
            </Link>

            {!loading && user && (
              <span className="nav-client-name d-none d-md-inline-flex" title={displayName}>
                {displayName}
              </span>
            )}
          </div>

          <button
            className="navbar-toggler site-nav-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="site-nav-toggler-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>

          <div className="collapse navbar-collapse site-nav-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center site-nav-list">
              <li className="nav-item">
                <Link to="/Services" className={navLinkClass('/Services')} onClick={handleNavClick}>
                  Services
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/About" className={navLinkClass('/About')} onClick={handleNavClick}>
                  About
                </Link>
              </li>
              <li className="nav-item">
                <Link to="/Contact" className={navLinkClass('/Contact')} onClick={handleNavClick}>
                  Contact
                </Link>
              </li>

              {!loading && user && (
                <li className="nav-item">
                  <Link to="/profile" className={navLinkClass('/profile')} onClick={handleNavClick}>
                    My profile
                  </Link>
                </li>
              )}

              {!loading && user && user.technician_pending && (
                <li className="nav-item">
                  <Link
                    to="/technician-pending"
                    className={navLinkClass('/technician-pending')}
                    onClick={handleNavClick}
                  >
                    Application pending
                  </Link>
                </li>
              )}

              {!loading && user && user.role === 'client' && !user.technician_pending && (
                <li className="nav-item">
                  <Link to="/my-bookings" className={navLinkClass('/my-bookings')} onClick={handleNavClick}>
                    My bookings
                  </Link>
                </li>
              )}

              {!loading && user && user.role === 'worker' && (
                <li className="nav-item">
                  <Link to="/worker" className={navLinkClass('/worker')} onClick={handleNavClick}>
                    Dashboard
                  </Link>
                </li>
              )}

              {!loading && user && user.role === 'salon_owner' && (
                <li className="nav-item">
                  <Link to="/owner" className={navLinkClass('/owner')} onClick={handleNavClick}>
                    My salons
                  </Link>
                </li>
              )}

              {!loading && user && user.role === 'admin' && (
                <>
                  <li className="nav-item">
                    <Link to="/admin" className={navLinkClass('/admin')} onClick={handleNavClick}>
                      Admin
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link to="/worker" className={navLinkClass('/worker')} onClick={handleNavClick}>
                      Dashboard
                    </Link>
                  </li>
                </>
              )}

              {!loading && !user && (
                <>
                  <li className="nav-item">
                    <Link to="/login" className={navLinkClass('/login')} onClick={handleNavClick}>
                      Log in
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link
                      to="/signup"
                      className={`${navLinkClass('/signup')} site-nav-link--accent`}
                      onClick={handleNavClick}
                    >
                      Sign up
                    </Link>
                  </li>
                </>
              )}

              {!loading && user && (
                <li className="nav-item nav-user-chip ms-lg-2">
                  <span className="nav-user-greeting">
                    Hi, {firstName}
                    <span className={`nav-role-badge nav-role-badge--${user.role}`}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </span>
                  <button type="button" className="btn btn-sm btn-outline-light nav-logout-btn" onClick={handleLogout}>
                    Log out
                  </button>
                </li>
              )}

              <li className="nav-item nav-item-booking ms-lg-2">
                <Bookservice />
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <div className="header text-center py-2 px-3">
        {!loading && user && (
          <p className="mb-0 nav-mobile-name d-md-none">{displayName}</p>
        )}
        <p className="mb-0 header-tagline">{tagline}</p>
      </div>
    </>
  )
}

export default Navbar
