import type { DayOfWeek } from '@/types'

export function getWeekDates(weekStart: Date): Record<DayOfWeek, Date> {
  const map: Partial<Record<DayOfWeek, Date>> = {}
  const days: DayOfWeek[] = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']
  days.forEach((d, i) => {
    const dt = new Date(weekStart)
    dt.setDate(weekStart.getDate() + i)
    map[d] = dt
  })
  return map as Record<DayOfWeek, Date>
}

export function getMonday(d: Date): Date {
  const dt = new Date(d)
  const day = dt.getDay()
  const diff = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + diff)
  dt.setHours(0, 0, 0, 0)
  return dt
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
