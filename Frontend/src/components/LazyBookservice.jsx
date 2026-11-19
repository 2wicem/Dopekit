import { lazy, Suspense } from 'react'

const Bookservice = lazy(() => import('./Bookservice'))

const LazyBookservice = (props) => (
  <Suspense
    fallback={
      <button type="button" className="btn btn-primary" disabled>
        {props.label || 'Book'}
      </button>
    }
  >
    <Bookservice {...props} />
  </Suspense>
)

export default LazyBookservice
