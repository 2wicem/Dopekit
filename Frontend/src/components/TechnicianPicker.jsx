import TechnicianRating from './TechnicianRating'

const TechnicianPreview = ({ worker }) => {
  if (!worker) {
    return null
  }

  return (
    <div className="technician-preview">
      <div className="technician-preview-header">
        <div>
          <p className="technician-preview-name">{worker.name}</p>
          <p className="technician-preview-role">{worker.role_label}</p>
          {worker.specialty_label && (
            <p className="technician-preview-specialty">{worker.specialty_label}</p>
          )}
          {worker.salon_name && !worker.is_freelance && (
            <p className="technician-preview-salon">{worker.salon_name}</p>
          )}
        </div>
        <span className={`technician-preview-availability${worker.is_available ? ' is-open' : ' is-booked'}`}>
          {worker.is_available ? 'Available' : 'Booked'}
        </span>
      </div>

      <TechnicianRating
        ratingAverage={worker.rating_average}
        ratingCount={worker.rating_count}
        completedJobs={worker.completed_jobs}
      />

      {worker.work_summary && (
        <div className="technician-preview-section">
          <h4 className="technician-preview-heading">Their work</h4>
          <p className="technician-preview-copy">{worker.work_summary}</p>
        </div>
      )}

      {worker.portfolio_urls?.length > 0 ? (
        <div className="technician-preview-section">
          <h4 className="technician-preview-heading">Portfolio</h4>
          <p className="technician-preview-portfolio-note">
            Tap an image to view their work before you book.
          </p>
          <div className="technician-preview-portfolio">
            {worker.portfolio_urls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`${worker.name} portfolio`} loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      ) : (
        <p className="technician-preview-portfolio-empty">
          This technician has not added portfolio photos yet.
        </p>
      )}

      {worker.is_freelance && (
        <p className="technician-preview-freelance-note">
          Mobile service — add your visit address below when you book.
        </p>
      )}

      <p className="technician-preview-slots">
        {worker.is_available
          ? `${worker.available_slots} open slot${worker.available_slots === 1 ? '' : 's'} in the next 2 weeks`
          : 'No open slots soon — you can still send a request and we will confirm a time.'}
      </p>
    </div>
  )
}

const TechnicianPicker = ({
  modalId,
  workers,
  selectedWorkerId,
  onChange,
  loading,
}) => {
  const selectedWorker =
    selectedWorkerId != null ? workers.find((entry) => entry.id === selectedWorkerId) : null

  if (loading) {
    return <p className="booking-worker-empty">Loading technicians...</p>
  }

  if (workers.length === 0) {
    return (
      <p className="booking-worker-empty booking-slot-empty--soft">
        No technicians listed right now. You can still send your request — we will assign someone
        and confirm your time.
      </p>
    )
  }

  return (
    <>
      <label htmlFor={`${modalId}-technician`} className="form-label">
        Technician <span className="booking-slot-optional">(optional)</span>
      </label>
      <p className="booking-portfolio-prompt">
        Pick a name below, then review their portfolio and ratings before you confirm.
      </p>
      <select
        id={`${modalId}-technician`}
        className="form-select site-select booking-technician-select"
        value={selectedWorkerId ?? ''}
        onChange={(event) => {
          const value = event.target.value
          onChange(value ? Number(value) : null)
        }}
      >
        <option value="">Any available technician</option>
        {workers.map((worker) => {
          const rating =
            worker.rating_count > 0 && worker.rating_average != null
              ? ` · ${Number(worker.rating_average).toFixed(1)}★`
              : ''
          const availabilityLabel = worker.is_available ? 'Available' : 'Booked'
          return (
            <option key={worker.id} value={worker.id}>
              {worker.name} · {worker.role_label}
              {worker.specialty_label ? ` · ${worker.specialty_label}` : ''}
              {rating} · {availabilityLabel}
            </option>
          )
        })}
      </select>

      {selectedWorker ? (
        <TechnicianPreview worker={selectedWorker} />
      ) : (
        <p className="booking-worker-note">
          Leave blank to let us match you with the first available technician — or choose someone
          and check their portfolio first.
        </p>
      )}
    </>
  )
}

export default TechnicianPicker
