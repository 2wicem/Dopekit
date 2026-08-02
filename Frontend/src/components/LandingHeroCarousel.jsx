import { useHeroCarousel } from '../hooks/useHeroCarousel'

const LandingHeroCarousel = ({ slides, compact = false, overlay = 'default', children }) => {
  const activeIndex = useHeroCarousel(slides.length)

  return (
    <section className={`landing-hero${compact ? ' landing-hero--compact' : ''}`}>
      <div className="landing-hero-carousel" aria-hidden="true">
        {slides.map(({ id, image, alt }, index) => (
          <img
            key={id}
            src={image}
            alt={alt}
            className={`landing-hero-bg${index === activeIndex ? ' is-active' : ''}`}
          />
        ))}
      </div>

      <div
        className={`landing-hero-overlay${overlay === 'salons' ? ' landing-hero-overlay--salons' : ''}${
          overlay === 'freelancers' ? ' landing-hero-overlay--freelancers' : ''
        }`}
        aria-hidden="true"
      />

      <div className="landing-hero-content container text-center">{children}</div>

      {slides.length > 1 && (
        <div className="landing-hero-dots" aria-hidden="true">
          {slides.map(({ id }, index) => (
            <span
              key={id}
              className={`landing-hero-dot${index === activeIndex ? ' is-active' : ''}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default LandingHeroCarousel
