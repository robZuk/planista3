import { ClassType, RoomType } from '@prisma/client'
import prisma from '../lib/prisma'

// Mapowanie: typ zajęć → dopuszczalne typy sal
const roomTypeMap: Record<ClassType, RoomType[]> = {
  LECTURE:  [RoomType.LECTURE, RoomType.EXERCISE],
  EXERCISE: [RoomType.EXERCISE, RoomType.LECTURE],
  LAB:      [RoomType.LAB, RoomType.COMPUTER_LAB],
  PROJECT:  [RoomType.EXERCISE, RoomType.COMPUTER_LAB, RoomType.SEMINAR],
  SEMINAR:  [RoomType.SEMINAR, RoomType.EXERCISE],
}

function getHoursLimit(
  entry: {
    hoursLecture: number
    hoursExercise: number
    hoursLab: number
    hoursProject: number
    hoursSeminar: number
  },
  classType: ClassType,
): number {
  switch (classType) {
    case ClassType.LECTURE:  return entry.hoursLecture
    case ClassType.EXERCISE: return entry.hoursExercise
    case ClassType.LAB:      return entry.hoursLab
    case ClassType.PROJECT:  return entry.hoursProject
    case ClassType.SEMINAR:  return entry.hoursSeminar
  }
}

export type ValidationError =
  | { code: 'HOURS_EXCEEDED'; details: { classType: ClassType; limit: number; alreadyPlanned: number; requested: number; remaining: number } }
  | { code: 'ROOM_CONFLICT';  details: { conflictId: string; dayOfWeek?: string; date?: string; startTime: string; endTime: string } }
  | { code: 'INSTRUCTOR_CONFLICT'; details: { conflictId: string; dayOfWeek?: string; date?: string; startTime: string; endTime: string } }
  | { code: 'GROUP_CONFLICT'; details: { conflictId: string; dayOfWeek?: string; date?: string; startTime: string; endTime: string } }
  | { code: 'WRONG_ROOM_TYPE'; details: { roomType: RoomType; classType: ClassType; allowed: RoomType[] } }
  | { code: 'TIME_WINDOW_VIOLATION'; details: { dayOfWeek: string; startTime: string; studyMode: string; allowed: string } }

export type TemplateDto = {
  curriculumEntryId: string
  classType: ClassType
  academicHours: number
  roomId: string
  instructorId: string
  studentGroupId?: string | null
  dayOfWeek: string
  startTime: string
  endTime: string
  semester: number
  academicYear: string
  weekType?: string
  studyMode?: string
  excludeId?: string
}

export type EntryConflictDto = {
  date: Date
  startTime: string
  endTime: string
  roomId: string
  instructorId: string
  studentGroupId?: string | null
  excludeId?: string
  // Opcjonalne — do sprawdzenia limitu godzin z siatki
  curriculumEntryId?: string
  classType?: ClassType
  academicHours?: number
}

function minsFromTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/**
 * Zwraca ID grup, które kolidują z daną grupą przy planowaniu zajęć:
 * - przodkowie (grupa → rodzic → dziadek…): student z ćwiczeń chodzi też na wykład
 * - sama grupa
 * - potomkowie (tylko jej własne dzieci/wnuki): student z laboratorium chodzi na ćwiczenia
 *
 * NIE zwraca rodzeństwa (np. EDST-1-C-B nie koliduje z EDST-1-C-A).
 */
async function getGroupFamily(groupId: string): Promise<string[]> {
  const family: string[] = [groupId]

  // 1. Idź w górę — zbierz wszystkich przodków
  let currentId = groupId
  while (true) {
    const group = await prisma.studentGroup.findUnique({
      where: { id: currentId },
      select: { parentGroupId: true },
    })
    if (!group?.parentGroupId) break
    family.push(group.parentGroupId)
    currentId = group.parentGroupId
  }

  // 2. BFS w dół od danej grupy — zbierz jej własnych potomków (nie rodzeństwo)
  const queue = [groupId]
  while (queue.length > 0) {
    const id = queue.shift()!
    const children = await prisma.studentGroup.findMany({
      where: { parentGroupId: id },
      select: { id: true },
    })
    for (const child of children) {
      family.push(child.id)
      queue.push(child.id)
    }
  }

  return family
}

// Walidacja szablonu (wzorzec tygodniowy)
export async function validateTemplateEntry(dto: TemplateDto): Promise<ValidationError | null> {
  // 0. Sprawdź okno czasowe trybu studiów
  if (dto.studyMode === 'PART_TIME') {
    const dayMap: Record<string, number> = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 0 }
    const day = dayMap[dto.dayOfWeek] ?? -1
    const startMins = minsFromTime(dto.startTime)
    const endMins = minsFromTime(dto.endTime)
    const violation = (allowed: string): ValidationError => ({
      code: 'TIME_WINDOW_VIOLATION',
      details: { dayOfWeek: dto.dayOfWeek, startTime: dto.startTime, studyMode: 'PART_TIME', allowed },
    })
    if (day >= 1 && day <= 4) return violation('Pt 15:00–20:00, Sb/Nd 07:00–20:00')
    if (day === 5 && (startMins < 15 * 60 || endMins > 20 * 60)) return violation('Piątek 15:00–20:00')
    if ((day === 6 || day === 0) && (startMins < 7 * 60 || endMins > 20 * 60)) return violation('Sobota/Niedziela 07:00–20:00')
  }

  // 1. Sprawdź typ sali
  const room = await prisma.room.findUnique({ where: { id: dto.roomId } })
  if (room) {
    const allowed = roomTypeMap[dto.classType]
    if (!allowed.includes(room.type)) {
      return { code: 'WRONG_ROOM_TYPE', details: { roomType: room.type, classType: dto.classType, allowed } }
    }
  }

  // Typy tygodnia które NIE kolidują z nowym szablonem:
  // EVEN i ODD nie nakładają się → mogą dzielić salę/prowadzącego
  const newWeekType = dto.weekType ?? 'EVERY'
  const compatibleWeekTypes: string[] = []
  if (newWeekType === 'EVEN') compatibleWeekTypes.push('ODD')
  if (newWeekType === 'ODD') compatibleWeekTypes.push('EVEN')

  // 3. Konflikt sali w szablonach (uwzględnia EVEN/ODD)
  const roomConflict = await prisma.scheduleTemplate.findFirst({
    where: {
      roomId: dto.roomId,
      dayOfWeek: dto.dayOfWeek as never,
      academicYear: dto.academicYear,
      AND: [{ startTime: { lt: dto.endTime } }, { endTime: { gt: dto.startTime } }],
      ...(compatibleWeekTypes.length > 0 ? { weekType: { notIn: compatibleWeekTypes as never[] } } : {}),
      ...(dto.excludeId ? { id: { not: dto.excludeId } } : {}),
    },
  })
  if (roomConflict) {
    return {
      code: 'ROOM_CONFLICT',
      details: { conflictId: roomConflict.id, dayOfWeek: roomConflict.dayOfWeek, startTime: roomConflict.startTime, endTime: roomConflict.endTime },
    }
  }

  // 4. Konflikt prowadzącego w szablonach (uwzględnia EVEN/ODD)
  const instructorConflict = await prisma.scheduleTemplate.findFirst({
    where: {
      instructorId: dto.instructorId,
      dayOfWeek: dto.dayOfWeek as never,
      academicYear: dto.academicYear,
      AND: [{ startTime: { lt: dto.endTime } }, { endTime: { gt: dto.startTime } }],
      ...(compatibleWeekTypes.length > 0 ? { weekType: { notIn: compatibleWeekTypes as never[] } } : {}),
      ...(dto.excludeId ? { id: { not: dto.excludeId } } : {}),
    },
  })
  if (instructorConflict) {
    return {
      code: 'INSTRUCTOR_CONFLICT',
      details: { conflictId: instructorConflict.id, dayOfWeek: instructorConflict.dayOfWeek, startTime: instructorConflict.startTime, endTime: instructorConflict.endTime },
    }
  }

  // 5. Konflikt grupy w szablonach (uwzględnia EVEN/ODD i hierarchię grup)
  // Sprawdzamy całą rodzinę grup: korzeń (wykład) + wszystkich potomków,
  // bo studenci z podgrup uczestniczą też w zajęciach grupy nadrzędnej.
  if (dto.studentGroupId) {
    const familyIds = await getGroupFamily(dto.studentGroupId)
    const groupConflict = await prisma.scheduleTemplate.findFirst({
      where: {
        studentGroupId: { in: familyIds },
        dayOfWeek: dto.dayOfWeek as never,
        academicYear: dto.academicYear,
        AND: [{ startTime: { lt: dto.endTime } }, { endTime: { gt: dto.startTime } }],
        ...(compatibleWeekTypes.length > 0 ? { weekType: { notIn: compatibleWeekTypes as never[] } } : {}),
        ...(dto.excludeId ? { id: { not: dto.excludeId } } : {}),
      },
    })
    if (groupConflict) {
      return {
        code: 'GROUP_CONFLICT',
        details: { conflictId: groupConflict.id, dayOfWeek: groupConflict.dayOfWeek, startTime: groupConflict.startTime, endTime: groupConflict.endTime },
      }
    }
  }

  return null
}

// Walidacja konfliktów dla konkretnych wpisów (date-based)
export async function validateEntryConflicts(dto: EntryConflictDto): Promise<ValidationError | null> {
  // 0. Sprawdź limit godzin z siatki (tylko przy ręcznym dodawaniu wpisu)
  if (dto.curriculumEntryId && dto.classType && dto.academicHours) {
    const currEntry = await prisma.curriculumEntry.findUnique({ where: { id: dto.curriculumEntryId } })
    if (currEntry) {
      const limit = getHoursLimit(currEntry, dto.classType)
      const planned = await prisma.scheduleEntry.aggregate({
        where: {
          curriculumEntryId: dto.curriculumEntryId,
          classType: dto.classType,
          status: { not: 'CANCELLED' },
          ...(dto.excludeId ? { id: { not: dto.excludeId } } : {}),
        },
        _sum: { academicHours: true },
      })
      const alreadyPlanned = planned._sum.academicHours ?? 0
      if (alreadyPlanned + dto.academicHours > limit) {
        return {
          code: 'HOURS_EXCEEDED',
          details: { classType: dto.classType, limit, alreadyPlanned, requested: dto.academicHours, remaining: limit - alreadyPlanned },
        }
      }
    }
  }

  const roomConflict = await prisma.scheduleEntry.findFirst({
    where: {
      roomId: dto.roomId,
      date: dto.date,
      AND: [{ startTime: { lt: dto.endTime } }, { endTime: { gt: dto.startTime } }],
      ...(dto.excludeId ? { id: { not: dto.excludeId } } : {}),
    },
  })
  if (roomConflict) {
    return {
      code: 'ROOM_CONFLICT',
      details: { conflictId: roomConflict.id, date: roomConflict.date.toISOString(), startTime: roomConflict.startTime, endTime: roomConflict.endTime },
    }
  }

  const instructorConflict = await prisma.scheduleEntry.findFirst({
    where: {
      instructorId: dto.instructorId,
      date: dto.date,
      AND: [{ startTime: { lt: dto.endTime } }, { endTime: { gt: dto.startTime } }],
      ...(dto.excludeId ? { id: { not: dto.excludeId } } : {}),
    },
  })
  if (instructorConflict) {
    return {
      code: 'INSTRUCTOR_CONFLICT',
      details: { conflictId: instructorConflict.id, date: instructorConflict.date.toISOString(), startTime: instructorConflict.startTime, endTime: instructorConflict.endTime },
    }
  }

  // Konflikt grupy w konkretnych wpisach — uwzględnia hierarchię grup:
  // sprawdzamy całą rodzinę (korzeń + potomkowie), żeby wykryć np. kolizję
  // wykładu EDST-1-W z ćwiczeniami EDST-1-C-A tego samego rocznika.
  if (dto.studentGroupId) {
    const familyIds = await getGroupFamily(dto.studentGroupId)
    const groupConflict = await prisma.scheduleEntry.findFirst({
      where: {
        studentGroupId: { in: familyIds },
        date: dto.date,
        AND: [{ startTime: { lt: dto.endTime } }, { endTime: { gt: dto.startTime } }],
        ...(dto.excludeId ? { id: { not: dto.excludeId } } : {}),
      },
    })
    if (groupConflict) {
      return {
        code: 'GROUP_CONFLICT',
        details: { conflictId: groupConflict.id, date: groupConflict.date.toISOString(), startTime: groupConflict.startTime, endTime: groupConflict.endTime },
      }
    }
  }

  return null
}

// Backwards-compatible aliases
export type ScheduleDto = TemplateDto
export const validateScheduleEntry = validateTemplateEntry
