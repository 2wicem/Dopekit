export const USERNAME_PATTERN = /^[a-zA-Z0-9._]{3,30}$/

export const validateUsername = (username) => {
  const value = username.trim()
  if (!value) {
    return 'Username is required.'
  }
  if (value.length < 3 || value.length > 30) {
    return 'Username must be 3–30 characters.'
  }
  if (!USERNAME_PATTERN.test(value)) {
    return 'Username can only use letters, numbers, dots, and underscores.'
  }
  return null
}
