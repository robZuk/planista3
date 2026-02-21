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
  | { code: 'ROOM_CONFLICT';  details: { conflictId: string; dayOfWeek: string; startTime: string; endTime: string } }
  | { code: 'INSTRUCTOR_CONFLICT'; details: { conflictId: string; dayOfWeek: string; startTime: string; endTime: string } }
  | { code: 'WRONG_ROOM_TYPE'; details: { roomType: RoomType; classType: ClassType; allowed: RoomType[] } }

export type ScheduleDto = {
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
  excludeId?: string  // przy edycji — pomiń ten wpis w sprawdzaniu konfliktów
}

export async function validateScheduleEntry(dto: ScheduleDto): Promise<ValidationError | null> {
  // 1. Sprawdź limit godzin z siatki
  const currEntry = await prisma.curriculumEntry.findUnique({
    where: { id: dto.curriculumEntryId },
  })
  if (!currEntry) {
    return null // brak wpisu obsługuje kontroler
  }

  const limit = getHoursLimit(currEntry, dto.classType)

  const planned = await prisma.scheduleEntry.aggregate({
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
      details: {
        classType: dto.classType,
        limit,
        alreadyPlanned,
        requested: dto.academicHours,
        remaining: limit - alreadyPlanned,
      },
    }
  }

  // 2. Sprawdź typ sali vs typ zajęć
  const room = await prisma.room.findUnique({ where: { id: dto.roomId } })
  if (room) {
    const allowed = roomTypeMap[dto.classType]
    if (!allowed.includes(room.type)) {
      return {
        code: 'WRONG_ROOM_TYPE',
        details: { roomType: room.type, classType: dto.classType, allowed },
      }
    }
  }

  // 3. Sprawdź konflikt sali
  const roomConflict = await prisma.scheduleEntry.findFirst({
    where: {
      roomId: dto.roomId,
      dayOfWeek: dto.dayOfWeek as never,
      academicYear: dto.academicYear,
      AND: [
        { startTime: { lt: dto.endTime } },
        { endTime: { gt: dto.startTime } },
      ],
      ...(dto.excludeId ? { id: { not: dto.excludeId } } : {}),
    },
  })
  if (roomConflict) {
    return {
      code: 'ROOM_CONFLICT',
      details: {
        conflictId: roomConflict.id,
        dayOfWeek: roomConflict.dayOfWeek,
        startTime: roomConflict.startTime,
        endTime: roomConflict.endTime,
      },
    }
  }

  // 4. Sprawdź konflikt prowadzącego
  const instructorConflict = await prisma.scheduleEntry.findFirst({
    where: {
      instructorId: dto.instructorId,
      dayOfWeek: dto.dayOfWeek as never,
      academicYear: dto.academicYear,
      AND: [
        { startTime: { lt: dto.endTime } },
        { endTime: { gt: dto.startTime } },
      ],
      ...(dto.excludeId ? { id: { not: dto.excludeId } } : {}),
    },
  })
  if (instructorConflict) {
    return {
      code: 'INSTRUCTOR_CONFLICT',
      details: {
        conflictId: instructorConflict.id,
        dayOfWeek: instructorConflict.dayOfWeek,
        startTime: instructorConflict.startTime,
        endTime: instructorConflict.endTime,
      },
    }
  }

  return null
}
