/* eslint-disable react/prop-types */
import { useState } from 'react'
import TechnicianScheduleModal from './TechnicianScheduleModal'
import './css/TechnicianSchedule.css'

const TechnicianScheduleButton = ({ worker, salonId = null, className = '' }) => {
  const [open, setOpen] = useState(false)

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
        />
      )}
    </>
  )
}

export default TechnicianScheduleButton
