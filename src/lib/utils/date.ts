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
 * Calculates the number of days between two dates using exact timestamps.
 * Fractions of a day are rounded up (e.g. 24.1 hours -> 2 days).
 * Minimum duration is 1 day.
 */
export function calculateDaysDifference(startDate: Date | string, endDate: Date | string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  const diffTime = end.getTime() - start.getTime()
  if (diffTime <= 0) return 1
  
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays)
}
