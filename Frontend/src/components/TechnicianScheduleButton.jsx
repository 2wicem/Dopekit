/* eslint-disable react/prop-types */
import { useRef, useState } from 'react'
import Bookservice from './Bookservice'
import TechnicianScheduleModal from './TechnicianScheduleModal'
import './css/TechnicianSchedule.css'

const TechnicianScheduleButton = ({ worker, salonId = null, className = '' }) => {
  const [open, setOpen] = useState(false)
  const bookingRef = useRef(null)

  const handleBookSlot = (prefill) => {
    setOpen(false)
    window.setTimeout(() => {
      bookingRef.current?.open(prefill ?? null)
    }, 0)
  }

  return (
    <>
      <button
        type="button"
        className={`technician-schedule-btn btn btn-outline-primary btn-sm${className ? ` ${className}` : ''}`}
        onClick={() => setOpen(true)}
      >
        View schedule
      </button>
      {open && (
        <TechnicianScheduleModal
          worker={worker}
          salonId={salonId}
          onClose={() => setOpen(false)}
          onBookSlot={handleBookSlot}
        />
      )}
      <Bookservice
        ref={bookingRef}
        hideTrigger
        variant="card"
        workerId={worker.id}
        workerName={worker.name}
        salonId={salonId ?? worker.salon_id}
        label={`Book with ${worker.name}`}
      />
    </>
  )
}

export default TechnicianScheduleButton
