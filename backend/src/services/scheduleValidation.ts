import { ClassType, RoomType } from '@prisma/client'
import prisma from '../lib/prisma'

// Mapowanie: typ zajęć → dopuszczalne typy sal
const roomTypeMap: Record<ClassType, RoomType[]> = {
  LECTURE:  [RoomType.LECTURE],
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
  | { code: 'GROUP_CONFLICT'; details: { conflictId: string; date?: string; startTime: string; endTime: string } }
  | { code: 'WRONG_ROOM_TYPE'; details: { roomType: RoomType; classType: ClassType; allowed: RoomType[] } }

export type TemplateDto = {
  curriculumEntryId: string
  classType: ClassType
  academicHours: number
  roomId: string
  instructorId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  semester: number
  academicYear: string
  weekType?: string
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
}

// Walidacja szablonu (wzorzec tygodniowy)
export async function validateTemplateEntry(dto: TemplateDto): Promise<ValidationError | null> {
  // 1. Sprawdź limit godzin z siatki
  const currEntry = await prisma.curriculumEntry.findUnique({
    where: { id: dto.curriculumEntryId },
  })
  if (!currEntry) return null

  const limit = getHoursLimit(currEntry, dto.classType)

  const planned = await prisma.scheduleTemplate.aggregate({
    where: {
      curriculumEntryId: dto.curriculumEntryId,
      classType: dto.classType,
      semester: dto.semester,
      academicYear: dto.academicYear,
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

  // 2. Sprawdź typ sali
  const room = await prisma.room.findUnique({ where: { id: dto.roomId } })
  if (room) {
    const allowed = roomTypeMap[dto.classType]
    if (!allowed.includes(room.type)) {
      return { code: 'WRONG_ROOM_TYPE', details: { roomType: room.type, classType: dto.classType, allowed } }
    }
  }

  // 3. Konflikt sali w szablonach
  const roomConflict = await prisma.scheduleTemplate.findFirst({
    where: {
      roomId: dto.roomId,
      dayOfWeek: dto.dayOfWeek as never,
      academicYear: dto.academicYear,
      AND: [{ startTime: { lt: dto.endTime } }, { endTime: { gt: dto.startTime } }],
      ...(dto.excludeId ? { id: { not: dto.excludeId } } : {}),
    },
  })
  if (roomConflict) {
    return {
      code: 'ROOM_CONFLICT',
      details: { conflictId: roomConflict.id, dayOfWeek: roomConflict.dayOfWeek, startTime: roomConflict.startTime, endTime: roomConflict.endTime },
    }
  }

  // 4. Konflikt prowadzącego w szablonach
  const instructorConflict = await prisma.scheduleTemplate.findFirst({
    where: {
      instructorId: dto.instructorId,
      dayOfWeek: dto.dayOfWeek as never,
      academicYear: dto.academicYear,
      AND: [{ startTime: { lt: dto.endTime } }, { endTime: { gt: dto.startTime } }],
      ...(dto.excludeId ? { id: { not: dto.excludeId } } : {}),
    },
  })
  if (instructorConflict) {
    return {
      code: 'INSTRUCTOR_CONFLICT',
      details: { conflictId: instructorConflict.id, dayOfWeek: instructorConflict.dayOfWeek, startTime: instructorConflict.startTime, endTime: instructorConflict.endTime },
    }
  }

  return null
}

// Walidacja konfliktów dla konkretnych wpisów (date-based)
export async function validateEntryConflicts(dto: EntryConflictDto): Promise<ValidationError | null> {
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

  if (dto.studentGroupId) {
    const groupConflict = await prisma.scheduleEntry.findFirst({
      where: {
        studentGroupId: dto.studentGroupId,
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
