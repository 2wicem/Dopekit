export const safeRedirectPath = (value) => {
  if (!value || typeof value !== 'string') {
    return null
  }

  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//')) {
    return null
  }

  return path
}

export const withRedirect = (path, redirectTo) => {
  const safePath = safeRedirectPath(redirectTo)
  if (!safePath) {
    return path
  }

  const params = new URLSearchParams({ redirect: safePath })
  return `${path}?${params.toString()}`
}

export const resolvePostAuthDestination = (account, redirectTo) => {
  const safeRedirect = safeRedirectPath(redirectTo)
  if (safeRedirect && account?.role === 'client' && !account?.technician_pending) {
    return safeRedirect
  }

  if (account?.technician_pending) {
    return '/technician-pending'
  }
  if (account?.role === 'admin') {
    return '/admin'
  }
  if (account?.role === 'salon_owner') {
    return '/owner'
  }
  if (account?.role === 'worker') {
    return '/worker'
  }
  return '/Services'
}
