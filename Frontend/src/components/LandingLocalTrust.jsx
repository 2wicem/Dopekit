import './css/Landing.css'

const CLIENT_STORIES = [
  {
    id: 'wanjiku',
    name: 'Wanjiku N.',
    place: 'Kikuyu Town',
    quote:
      'Booked a gel set at Dopekit studio and it lasted past two weeks. Easy slot, no waiting around.',
  },
  {
    id: 'mercy',
    name: 'Mercy A.',
    place: 'Kidfarmaco',
    quote:
      'They came to my place for a pedicure before an event. Clean work and they kept the time they promised.',
  },
  {
    id: 'faith',
    name: 'Faith K.',
    place: 'Sigona',
    quote:
      'Acrylics and overlay without the guesswork. I picked the technician on the site and paid at the salon.',
  },
]

const KIAMBU_AREAS = [
  'Kikuyu Town',
  'Kidfarmaco',
  'Zambezi',
  'Sigona',
  'Muthiga',
  'Wangige',
  'Kabete',
  'Limuru',
  'Kiambu Town',
  'Ruiru',
]

const NAIROBI_AREAS = [
  'Westlands',
  'Kilimani',
  'Lavington',
  'South C',
  'Kasarani',
  'Githurai',
  'CBD',
  'Riruta',
]

const FAQS = [
  {
    id: 'where',
    question: 'Where is Dopekit located?',
    answer:
      'Dopekit studio is in Kikuyu Town, Kiambu County. You can also book a mobile technician for outdoor service at your location across Kiambu and Nairobi.',
  },
  {
    id: 'book',
    question: 'How do I book a manicure or pedicure?',
    answer:
      'Choose a salon or freelance technician, pick a 2-hour slot, and confirm online. You can also walk in and the technician or salon owner will log the job.',
  },
  {
    id: 'services',
    question: 'What nail services do you offer?',
    answer:
      'Gel, builder, tips, acrylics, manicure and pedicure — indoor at the salon or outdoor at your place.',
  },
]

const LandingLocalTrust = () => (
  <section className="landing-trust" aria-labelledby="landing-trust-heading">
    <div className="container landing-trust-inner">
      <header className="landing-trust-header">
        <p className="landing-trust-eyebrow">Kikuyu · Kiambu · Nairobi</p>
        <h2 id="landing-trust-heading">What visitors say</h2>
        <p className="landing-trust-lead">
          People searching for a nail salon in Kikuyu want lasting sets, clear prices, and a booking
          they can trust. This is what clients tell us after gel, acrylics, and home visits.
        </p>
      </header>

      <div className="landing-trust-quotes">
        {CLIENT_STORIES.map((story) => (
          <figure key={story.id} className="landing-trust-quote">
            <div className="landing-trust-stars" aria-label="5 stars">
              ★★★★★
            </div>
            <blockquote>{story.quote}</blockquote>
            <figcaption>
              <strong>{story.name}</strong>
              <span>{story.place}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="landing-trust-areas">
        <h3>Areas we serve</h3>
        <p>Based in Kikuyu Town — salon visits and mobile nail care across Kiambu and Nairobi.</p>
        <p className="landing-trust-area-label">Kiambu</p>
        <ul>
          {KIAMBU_AREAS.map((area) => (
            <li key={area}>{area}</li>
          ))}
        </ul>
        <p className="landing-trust-area-label">Nairobi</p>
        <ul>
          {NAIROBI_AREAS.map((area) => (
            <li key={area}>{area}</li>
          ))}
        </ul>
      </div>

      <div className="landing-trust-faq">
        <h3>Questions visitors ask</h3>
        {FAQS.map((item) => (
          <details key={item.id}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
)

export default LandingLocalTrust
