import { useLocation } from 'react-router-dom'

/** Renders the current router location so tests can assert on the URL. */
export function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}
