export function subMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60 * 1000)
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000)
}
