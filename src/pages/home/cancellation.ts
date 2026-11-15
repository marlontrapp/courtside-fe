import { ApiError } from '@/api/client'

export type CancelErrors = {
  /** Shown in the dialog. */
  general?: string
  /** Error on the reason field. */
  reason?: string
  /** Retrying won't help (deadline passed, gone, not yours): disable confirm. */
  final?: boolean
  /** The list no longer matches the server: refresh it. */
  stale?: boolean
  sessionExpired?: boolean
}

const SESSION_DETAIL = /credentials were not provided|not authenticated|session/i

/** Map a failed cancellation onto the confirmation dialog. */
export function cancelErrors(error: unknown): CancelErrors {
  if (!(error instanceof ApiError)) {
    return error instanceof TypeError
      ? { general: "Can't reach CourtControl. Check your connection and try again." }
      : { general: 'Something went wrong while cancelling. Try again.' }
  }

  // 403 is both "signed out" and "you're a guest here"; the detail tells them apart.
  if (
    error.status === 401 ||
    (error.status === 403 && SESSION_DETAIL.test(error.message))
  ) {
    return {
      general: 'Your session has expired. Sign in again to cancel.',
      sessionExpired: true,
    }
  }
  if (error.status === 403) {
    // e.g. "Only the player who made the booking can cancel it."
    return { general: error.message, final: true, stale: true }
  }
  if (error.status === 404) {
    return {
      general: 'This booking no longer exists — it may already have been removed.',
      final: true,
      stale: true,
    }
  }
  if (error.status === 409) {
    // CourtControl explains: deadline passed (with the policy), already started, …
    return { general: error.message, final: true, stale: true }
  }
  if (error.status === 400 && error.fieldErrors.reason) {
    return { reason: error.fieldErrors.reason.join(' ') }
  }
  if (error.status >= 500) {
    return {
      general: `CourtControl couldn't cancel the booking right now (${error.status}). Try again in a moment.`,
    }
  }
  if (error.status === 0) {
    // Cancelled, but the confirmation was unreadable: don't invite a retry.
    return { general: error.message, final: true, stale: true }
  }
  return { general: error.message }
}
