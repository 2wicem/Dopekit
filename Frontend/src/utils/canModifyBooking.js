export const canModifyBooking = (booking) => {
  if (!booking || booking.status === 'cancelled') {
    return false
  }

  const appointmentDate = booking.slot?.date || booking.requested_date
  if (!appointmentDate) {
    return true
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const when = new Date(`${appointmentDate}T12:00:00`)
  return when >= today
}
