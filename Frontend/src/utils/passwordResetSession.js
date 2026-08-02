const STORAGE_PREFIX = 'dopekit_pw_reset_'

export const saveResetSession = ({ identifier, channel, maskedDestination }) => {
  sessionStorage.setItem(`${STORAGE_PREFIX}identifier`, identifier)
  sessionStorage.setItem(`${STORAGE_PREFIX}channel`, channel)
  sessionStorage.setItem(`${STORAGE_PREFIX}masked`, maskedDestination || '')
}

export const loadResetSession = () => ({
  identifier: sessionStorage.getItem(`${STORAGE_PREFIX}identifier`) || '',
  channel: sessionStorage.getItem(`${STORAGE_PREFIX}channel`) || 'email',
  maskedDestination: sessionStorage.getItem(`${STORAGE_PREFIX}masked`) || '',
})

export const clearResetSession = () => {
  sessionStorage.removeItem(`${STORAGE_PREFIX}identifier`)
  sessionStorage.removeItem(`${STORAGE_PREFIX}channel`)
  sessionStorage.removeItem(`${STORAGE_PREFIX}masked`)
}
