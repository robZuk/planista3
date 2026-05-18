import type { ClassType, DayOfWeek } from '@/types'

export const DAYS_FULL: { key: DayOfWeek; label: string }[] = [
  { key: 'MONDAY',    label: 'Poniedziałek' },
  { key: 'TUESDAY',   label: 'Wtorek' },
  { key: 'WEDNESDAY', label: 'Środa' },
  { key: 'THURSDAY',  label: 'Czwartek' },
  { key: 'FRIDAY',    label: 'Piątek' },
]

export const DAYS_PART: { key: DayOfWeek; label: string }[] = [
  { key: 'FRIDAY',   label: 'Piątek' },
  { key: 'SATURDAY', label: 'Sobota' },
  { key: 'SUNDAY',   label: 'Niedziela' },
]

export const CLASS_COLORS: Record<ClassType, string> = {
  LECTURE:  'bg-blue-500/15   border-blue-400   text-blue-800   dark:bg-blue-500/20   dark:text-blue-300',
  EXERCISE: 'bg-green-500/15  border-green-400  text-green-800  dark:bg-green-500/20  dark:text-green-300',
  LAB:      'bg-orange-500/15 border-orange-400 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',
  PROJECT:  'bg-purple-500/15 border-purple-400 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300',
  SEMINAR:  'bg-pink-500/15   border-pink-400   text-pink-800   dark:bg-pink-500/20   dark:text-pink-300',
}

export const CLASS_LABELS: Record<ClassType, string> = {
  LECTURE: 'W', EXERCISE: 'C', LAB: 'L', PROJECT: 'P', SEMINAR: 'S',
}

export const WEEK_TYPE_LABELS = { EVERY: 'Co tydzień', EVEN: 'Parzyste', ODD: 'Nieparzyste' }

export const CLASS_FULL_LABELS: Record<string, string> = {
  LECTURE: 'Wykład', EXERCISE: 'Ćwiczenia', LAB: 'Laboratorium', PROJECT: 'Projekt', SEMINAR: 'Seminarium',
}

export const ROOM_TYPE_LABELS: Record<string, string> = {
  LECTURE: 'wykładowa', EXERCISE: 'ćwiczeniowa', LAB: 'laboratoryjna',
  COMPUTER_LAB: 'komputerowa', SEMINAR: 'seminaryjna', SPORTS: 'sportowa',
}

export const DAY_SHORT: Record<string, string> = {
  MONDAY: 'pon', TUESDAY: 'wt', WEDNESDAY: 'śr', THURSDAY: 'czw',
  FRIDAY: 'pt', SATURDAY: 'sob', SUNDAY: 'nd',
}

export const ROOM_TYPES_FOR_CLASS: Record<string, string[]> = {
  LECTURE:  ['LECTURE'],
  EXERCISE: ['EXERCISE', 'LECTURE'],
  LAB:      ['LAB', 'COMPUTER_LAB'],
  PROJECT:  ['EXERCISE', 'COMPUTER_LAB', 'SEMINAR'],
  SEMINAR:  ['SEMINAR', 'EXERCISE'],
}

export const SLOT_MINS   = 5
export const SLOT_HEIGHT = 7
export const START_HOUR  = 7
export const END_HOUR    = 20
export const START_MINS  = START_HOUR * 60

export const ACADEMIC_HOUR_MINS = 45
export const BREAK_MINS = 15
export const SLOT_UNIT = ACADEMIC_HOUR_MINS + BREAK_MINS

function generateSlots(): string[] {
  const slots: string[] = []
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINS) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots
}

export const SLOTS = generateSlots()

export type SpecWithChain = {
  id: string
  name: string
  shortName: string
  fieldOfStudyId: string
  fieldOfStudy?: {
    id: string
    name: string
    shortName: string
    facultyId: string
    faculty?: { id: string; name: string; shortName: string }
  }
}
