import { END_HOUR, SLOT_HEIGHT, SLOT_MINS, START_MINS } from './constants'

export function getValidSlots(
  occupied: Array<{ start: number; end: number }>,
  blockMins: number,
  checkMins = blockMins,
  windowFrom = START_MINS,
): Array<{ top: number; height: number }> {
  const slots: Array<{ top: number; height: number }> = []
  for (let s = Math.max(START_MINS, windowFrom); s + blockMins <= END_HOUR * 60; s += 30) {
    if (!occupied.some(o => o.start < s + checkMins && o.end > s)) {
      slots.push({
        top: (s - START_MINS) / SLOT_MINS * SLOT_HEIGHT,
        height: blockMins / SLOT_MINS * SLOT_HEIGHT - 2,
      })
    }
  }
  return slots
}

/** Minimalna liczba minut od północy dla początku slotu w danym dniu (PART_TIME).
 *  Zwraca null gdy dzień jest w ogóle niedozwolony. */
export function partTimeWindowFrom(dayKey: string): number | null {
  switch (dayKey) {
    case 'FRIDAY':   return 15 * 60
    case 'SATURDAY':
    case 'SUNDAY':   return 7 * 60
    default:         return null
  }
}

// EVEN+ODD nie kolidują; wszystkie inne kombinacje kolidują
export function weekTypesConflict(a: string, b: string): boolean {
  return !((a === 'EVEN' && b === 'ODD') || (a === 'ODD' && b === 'EVEN'))
}
