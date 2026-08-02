import { useCallback, useEffect, useState } from 'react'
import contactEnvelope from './images/contact-envelope.svg'
import { useAuth } from '../context/useAuth'
import { apiFetch } from '../config/api'
import './css/Contact.css'

const CONTACT_PATH = '/products/contact/'
const CONTACT_INFO_PATH = '/products/contact/info/'

const DEFAULT_CONTACT_INFO = {
  phones: ['0790331108', '0727083181'],
  email: 'dopekit@gmail.com',
  location: 'Wangige Mall',
  services_summary: 'Indoor and outdoor manicure & pedicure',
  page_lead:
    'Have a question or want to book an appointment? Reach out — we would love to hear from you.',
}

const formatPhoneDisplay = (phone) => {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  return phone
}

const phoneTelHref = (phone) => {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('254')) {
    return `tel:+${digits}`
  }
  if (digits.startsWith('0')) {
    return `tel:+254${digits.slice(1)}`
  }
  return `tel:${phone}`
}

const emptyNote = { name: '', phone: '', email: '', message: '' }

const noteFromUser = (user) => {
  if (!user) {
    return emptyNote
  }

  return {
    name: user.name || '',
    phone: user.phone || '',
    email: user.email || '',
    message: '',
  }
}

const Contact = () => {
  const { user } = useAuth()
  const [contactInfo, setContactInfo] = useState(DEFAULT_CONTACT_INFO)
  const [note, setNote] = useState(emptyNote)
  const [noteStatus, setNoteStatus] = useState(null)
  const [sending, setSending] = useState(false)
  const [infoLoading, setInfoLoading] = useState(true)

  const loadContactInfo = useCallback(async () => {
    try {
      const response = await apiFetch(CONTACT_INFO_PATH)
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (response.ok && data.contact_info) {
        setContactInfo(data.contact_info)
      }
    } catch {
      setContactInfo(DEFAULT_CONTACT_INFO)
    } finally {
      setInfoLoading(false)
    }
  }, [])

  useEffect(() => {
    loadContactInfo()
  }, [loadContactInfo])

  useEffect(() => {
    setNote(noteFromUser(user))
  }, [user])

  const handleNoteChange = (event) => {
    const { name, value } = event.target
    setNote((current) => ({ ...current, [name]: value }))
    if (noteStatus) {
      setNoteStatus(null)
    }
  }

  const handleNoteSubmit = async (event) => {
    event.preventDefault()

    const name = note.name.trim()
    const phone = note.phone.trim()
    const email = note.email.trim()
    const message = note.message.trim()

    if (!message) {
      setNoteStatus({ type: 'error', text: 'Please write a short message on the letter.' })
      return
    }

    setSending(true)
    setNoteStatus(null)

    try {
      const response = await apiFetch(CONTACT_PATH, {
        method: 'POST',
        body: JSON.stringify({ name, phone, email, message }),
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not send your note.')
      }

      setNote(noteFromUser(user))
      setNoteStatus({ type: 'success', text: data.message || 'Note sent — we will reply soon.' })
    } catch (error) {
      setNoteStatus({ type: 'error', text: error.message })
    } finally {
      setSending(false)
    }
  }

  const phones = contactInfo.phones?.length
    ? contactInfo.phones
    : [contactInfo.phone_primary, contactInfo.phone_secondary].filter(Boolean)

  return (
    <section className="section-band section-band--base contact-page">
      <div className="container page-section contact-page__inner">
        <header className="contact-header text-center">
          <h1 className="contact-title">Contact Us</h1>
          <p className="contact-lead">
            {infoLoading ? DEFAULT_CONTACT_INFO.page_lead : contactInfo.page_lead}
          </p>
        </header>

        <figure className="contact-envelope">
          <img src={contactEnvelope} alt="" width={960} height={560} decoding="async" />
          <form className="contact-envelope-note" onSubmit={handleNoteSubmit} noValidate>
            <div className="contact-envelope-note__paper">
              <p className="contact-envelope-note__heading">
                <i className="fa-solid fa-pen-nib" aria-hidden="true" />
                Quick note
              </p>

              <div className="contact-envelope-note__fields">
                <div className="contact-envelope-note__contact-grid">
                  <label className="visually-hidden" htmlFor="contact-note-name">
                    Your name
                  </label>
                  <input
                    id="contact-note-name"
                    type="text"
                    name="name"
                    className="contact-envelope-note__input contact-envelope-note__input--name"
                    value={note.name}
                    onChange={handleNoteChange}
                    placeholder="Your name"
                    autoComplete="name"
                    readOnly={Boolean(user)}
                  />

                  <label className="visually-hidden" htmlFor="contact-note-phone">
                    Your phone
                  </label>
                  <input
                    id="contact-note-phone"
                    type="tel"
                    name="phone"
                    className="contact-envelope-note__input"
                    value={note.phone}
                    onChange={handleNoteChange}
                    placeholder="Phone"
                    autoComplete="tel"
                    readOnly={Boolean(user)}
                  />

                  <label className="visually-hidden" htmlFor="contact-note-email">
                    Your email
                  </label>
                  <input
                    id="contact-note-email"
                    type="email"
                    name="email"
                    className="contact-envelope-note__input"
                    value={note.email}
                    onChange={handleNoteChange}
                    placeholder="Email"
                    autoComplete="email"
                    readOnly={Boolean(user)}
                  />
                </div>

                <label className="visually-hidden" htmlFor="contact-note-message">
                  Your message
                </label>
                <textarea
                  id="contact-note-message"
                  name="message"
                  className="contact-envelope-note__textarea"
                  value={note.message}
                  onChange={handleNoteChange}
                  placeholder="Your message…"
                  rows={2}
                  required
                />
              </div>

              <button type="submit" className="contact-envelope-note__send" disabled={sending}>
                <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>

            {noteStatus && (
              <p className={`contact-envelope-note__status contact-envelope-note__status--${noteStatus.type}`}>
                {noteStatus.text}
              </p>
            )}
          </form>
        </figure>

        <div className="row justify-content-center contact-content">
          <div className="col-12 col-sm-11 col-md-9 col-lg-7 col-xl-6">
            <div className="card contact-card shadow-sm border-0">
              <div className="card-body contact-card__body">
                <ul className="contact-details list-unstyled mb-0">
                  <li className="contact-detail">
                    <span className="contact-detail__icon" aria-hidden="true">
                      <i className="fa-solid fa-phone" />
                    </span>
                    <div className="contact-detail__body">
                      <strong>Phone</strong>
                      <div className="contact-detail__phones">
                        {phones.map((phone) => (
                          <a key={phone} href={phoneTelHref(phone)}>
                            {formatPhoneDisplay(phone)}
                          </a>
                        ))}
                      </div>
                    </div>
                  </li>

                  <li className="contact-detail">
                    <span className="contact-detail__icon" aria-hidden="true">
                      <i className="fa-solid fa-envelope" />
                    </span>
                    <div className="contact-detail__body">
                      <strong>Email</strong>
                      <a className="contact-detail__link" href={`mailto:${contactInfo.email}`}>
                        {contactInfo.email}
                      </a>
                    </div>
                  </li>

                  <li className="contact-detail">
                    <span className="contact-detail__icon" aria-hidden="true">
                      <i className="fa-solid fa-location-dot" />
                    </span>
                    <div className="contact-detail__body">
                      <strong>Location</strong>
                      <span>{contactInfo.location}</span>
                    </div>
                  </li>

                  <li className="contact-detail">
                    <span className="contact-detail__icon" aria-hidden="true">
                      <i className="fa-solid fa-spa" />
                    </span>
                    <div className="contact-detail__body">
                      <strong>Services</strong>
                      <span>{contactInfo.services_summary}</span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <p className="contact-footnote text-muted text-center">
          To book a specific service, visit the Services page and use the booking form.
        </p>
      </div>
    </section>
  )
}

export default Contact
