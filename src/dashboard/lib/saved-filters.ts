/**
 * The dashboard filters are kept in this browser so a refresh keeps the selection.
 * They belong to one sign-in: cleared on sign-out and again on the next sign-in (which also covers an expired session).
 */
export const FILTERS_KEY = 'reclimate-dashboard-filters'

export function clearSavedFilters() {
  try {
    localStorage.removeItem(FILTERS_KEY)
  } catch {
    /* storage unavailable */
  }
}
