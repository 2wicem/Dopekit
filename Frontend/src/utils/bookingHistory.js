import { todayIso } from '../constants/slots'

export const BOOKING_HISTORY_TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
]

export const getBookingAppointmentDate = (booking) => booking?.slot?.date || booking?.requested_date || null

export const isCancelledBooking = (booking) => booking?.status === 'cancelled'

export const isPastBooking = (booking, referenceDate = todayIso()) => {
  if (isCancelledBooking(booking)) {
    return true
  }

  const appointmentDate = getBookingAppointmentDate(booking)
  if (!appointmentDate) {
    return false
  }

  return appointmentDate < referenceDate
}

export const isUpcomingBooking = (booking, referenceDate = todayIso()) => {
  if (isCancelledBooking(booking)) {
    return false
  }

  const appointmentDate = getBookingAppointmentDate(booking)
  if (!appointmentDate) {
    return true
  }

  return appointmentDate >= referenceDate
}

const compareAppointmentsAsc = (leftBooking, rightBooking) => {
  const leftDate = getBookingAppointmentDate(leftBooking)
  const rightDate = getBookingAppointmentDate(rightBooking)

  if (leftDate && rightDate && leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate)
  }

  if (leftDate && !rightDate) {
    return -1
  }

  if (!leftDate && rightDate) {
    return 1
  }

  const leftHour = leftBooking.slot?.start_hour ?? 99
  const rightHour = rightBooking.slot?.start_hour ?? 99
  if (leftHour !== rightHour) {
    return leftHour - rightHour
  }

  return new Date(rightBooking.created_at) - new Date(leftBooking.created_at)
}

const compareAppointmentsDesc = (leftBooking, rightBooking) => compareAppointmentsAsc(rightBooking, leftBooking)

const sortUpcomingBookings = (bookings) => [...bookings].sort(compareAppointmentsAsc)

const sortPastBookings = (bookings) => [...bookings].sort(compareAppointmentsDesc)

const sortAllBookings = (bookings, referenceDate) => {
  const upcoming = bookings.filter((booking) => isUpcomingBooking(booking, referenceDate))
  const past = bookings.filter((booking) => isPastBooking(booking, referenceDate))
  return [...sortUpcomingBookings(upcoming), ...sortPastBookings(past)]
}

export const filterBookingsByHistoryTab = (bookings, tab, referenceDate = todayIso()) => {
  if (tab === 'upcoming') {
    return sortUpcomingBookings(bookings.filter((booking) => isUpcomingBooking(booking, referenceDate)))
  }

  if (tab === 'past') {
    return sortPastBookings(bookings.filter((booking) => isPastBooking(booking, referenceDate)))
  }

  return sortAllBookings(bookings, referenceDate)
}

export const countBookingsByHistoryTab = (bookings, referenceDate = todayIso()) => ({
  upcoming: bookings.filter((booking) => isUpcomingBooking(booking, referenceDate)).length,
  past: bookings.filter((booking) => isPastBooking(booking, referenceDate)).length,
  all: bookings.length,
})

export const emptyHistoryMessage = (tab) => {
  if (tab === 'upcoming') {
    return 'No upcoming appointments. Book a service to get started.'
  }

  if (tab === 'past') {
    return 'No past bookings yet — cancelled and completed visits will appear here.'
  }

  return 'No bookings yet.'
}
