import { SLOT_HEIGHT, SLOT_MINS, START_MINS } from './constants'

export function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function minsToTime(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

export function blockStyle(startTime: string, endTime: string): React.CSSProperties {
  const start = timeToMins(startTime) - START_MINS
  const totalMins = timeToMins(endTime) - timeToMins(startTime)
  return {
    position: 'absolute',
    top: (start / SLOT_MINS) * SLOT_HEIGHT,
    height: (totalMins / SLOT_MINS) * SLOT_HEIGHT - 2,
    left: 4, right: 4,
    display: 'flex',
    flexDirection: 'column',
  }
}
