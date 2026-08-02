import { useEffect, useState } from 'react'
import AvailableSalons from './AvailableSalons'
import AvailableWorkers from './AvailableWorkers'
import Bookservice from './Bookservice'
import { carouselSlides, priceList, serviceCards } from './servicesData'
import './css/Services.css'

const SLIDE_INTERVAL_MS = 2500

const formatPrice = (amount) => `KSh ${amount.toLocaleString()}`

const Services = () => {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % carouselSlides.length)
    }, SLIDE_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [])

  const goToSlide = (index) => setActiveIndex(index)
  const goPrev = () =>
    setActiveIndex((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length)
  const goNext = () => setActiveIndex((prev) => (prev + 1) % carouselSlides.length)

  const openRowBooking = (event) => {
    event.stopPropagation()
    event.currentTarget.querySelector('[data-booking-trigger]')?.click()
  }

  const handleRowKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openRowBooking(event)
    }
  }

  return (
    <div className="services-page">
      <section className="section-band section-band--alt">
        <div className="services-intro mx-2 mx-md-4 p-3 p-md-4 rounded-3">
          <h1 className="h4 h-md-3 mb-2 services-page-title">
            Perfect nails for every event &amp; occasion
          </h1>
          <h2 className="h6 h-md-5 services-intro-sub mb-4">
            Tap a service to book — pick from our menu or explore the full collection below.
          </h2>

          <div className="row g-3 g-lg-4 align-items-start services-intro-layout">
            <div className="col-12 col-lg-5 col-xl-4 services-price-col">
              <div className="services-price-panel">
                <div className="services-price-panel-header">
                  <span className="services-price-panel-icon" aria-hidden="true">
                    <i className="fa-solid fa-sparkles" />
                  </span>
                  <div>
                    <h3 className="services-price-panel-title">Price menu</h3>
                    <p className="services-price-panel-sub">Tap any row to book instantly</p>
                  </div>
                </div>

                <ul className="services-price-list-items">
                  {priceList.map(({ id, name, price, tag }, index) => (
                    <li key={id}>
                      <div
                        className="services-price-item"
                        role="button"
                        tabIndex={0}
                        onClick={openRowBooking}
                        onKeyDown={handleRowKeyDown}
                        aria-label={`Book ${name}`}
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="services-price-item-main">
                          <span className="services-price-item-tag">{tag}</span>
                          <span className="services-price-item-name">
                            <Bookservice serviceName={name} variant="table" />
                          </span>
                        </div>
                        <span className="services-price-item-amount">{formatPrice(price)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="col-12 col-lg-7 col-xl-8 services-carousel-col">
              <div className="carousel slide carousel-fade services-carousel w-100">
                <div className="carousel-indicators">
                  {carouselSlides.map(({ id }, index) => (
                    <button
                      key={id}
                      type="button"
                      className={index === activeIndex ? 'active' : ''}
                      aria-current={index === activeIndex ? 'true' : undefined}
                      aria-label={`Slide ${index + 1}`}
                      onClick={() => goToSlide(index)}
                    />
                  ))}
                </div>

                <div className="carousel-inner rounded-4 shadow">
                  {carouselSlides.map(({ id, title, image, alt }, index) => (
                    <div
                      key={id}
                      className={`carousel-item${index === activeIndex ? ' active' : ''}`}
                    >
                      <img src={image} className="d-block w-100 carousel-img" alt={alt} />
                      <div className="carousel-caption services-carousel-caption">
                        <p className="mb-0">{title}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="carousel-control-prev" type="button" onClick={goPrev}>
                  <span className="carousel-control-prev-icon" aria-hidden="true" />
                  <span className="visually-hidden">Previous</span>
                </button>
                <button className="carousel-control-next" type="button" onClick={goNext}>
                  <span className="carousel-control-next-icon" aria-hidden="true" />
                  <span className="visually-hidden">Next</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-band section-band--base">
        <div className="container-fluid px-2 px-md-4">
          <AvailableSalons />
        </div>
      </section>

      <section className="section-band section-band--base">
        <div className="container-fluid px-2 px-md-4">
          <AvailableWorkers />
        </div>
      </section>

      <section className="section-band section-band--base">
        <div className="container-fluid px-2 px-md-4 services-cards-section">
          <div className="services-cards-header text-center">
            <span className="services-cards-eyebrow">Full collection</span>
            <h2 className="services-cards-heading">Our services</h2>
            <p className="services-cards-sub">
              Every look below is bookable — choose your service and lock in a 2-hour slot.
            </p>
          </div>

          <div className="row g-3 g-md-4 justify-content-center services-cards-row">
            {serviceCards.map(({ id, title, serviceName, price, image, alt, description }, index) => (
              <div key={id} className="col-6 col-md-4 col-lg-3">
                <article
                  className="card custom-card h-100"
                  style={{ animationDelay: `${index * 0.06}s` }}
                >
                  <div className="service-card-img-wrap">
                    <img src={image} className="card-img-top service-card-img" alt={alt} />
                    {price != null && (
                      <span className="service-card-price-badge">{formatPrice(price)}</span>
                    )}
                  </div>
                  <div className="card-body text-center service-card-body">
                    <h3 className="card-title service-card-title">{title}</h3>
                    <p className="card-text card-text-muted service-card-desc">{description}</p>
                    <Bookservice serviceName={serviceName} variant="card" />
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default Services
