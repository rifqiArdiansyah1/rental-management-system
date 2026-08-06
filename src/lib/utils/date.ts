/**
 * Date utility functions for booking calculations.
 */

/**
 * Normalizes a date to the start of the day (00:00:00.000) in the local timezone.
 * Useful for calculating full days without timezone shift off-by-one errors.
 */
export function startOfDay(date: Date | string | number): Date {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Calculates the number of days between two dates.
 * Fractions of a day are rounded up (e.g. 1.5 days -> 2 days).
 * Minimum duration is 1 day.
 */
export function calculateDaysDifference(startDate: Date | string, endDate: Date | string): number {
  const start = startOfDay(startDate)
  const end = startOfDay(endDate)
  
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  // Ensure minimum of 1 day rental
  return Math.max(1, diffDays)
}
