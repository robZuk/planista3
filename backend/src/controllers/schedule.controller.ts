import { Request, Response } from 'express'
import { ClassType, WeekType, DayOfWeek } from '@prisma/client'
import prisma from '../lib/prisma'
import { isNotFoundError } from '../lib/prismaErrors'
import { validateScheduleEntry, ScheduleDto } from '../services/scheduleValidation'

const scheduleInclude = {
  curriculumEntry: {
    include: {
      subject: { select: { id: true, name: true } },
    },
  },
  room: { select: { id: true, number: true, type: true, building: { select: { name: true } } } },
  instructor: { select: { id: true, firstName: true, lastName: true, title: true } },
}

export const getAll = async (req: Request, res: Response) => {
  try {
    const { semester, academicYear } = req.query
    const data = await prisma.scheduleEntry.findMany({
      where: {
        ...(semester ? { semester: Number(semester) } : {}),
        ...(academicYear ? { academicYear: String(academicYear) } : {}),
      },
      include: scheduleInclude,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const data = await prisma.scheduleEntry.findUnique({
      where: { id: req.params.id },
      include: scheduleInclude,
    })
    if (!data) return res.status(404).json({ error: 'Wpis planu nie znaleziony' })
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const {
      curriculumEntryId,
      classType,
      academicHours,
      roomId,
      instructorId,
      dayOfWeek,
      startTime,
      endTime,
      semester,
      academicYear,
      weekType,
    } = req.body as {
      curriculumEntryId: string
      classType: ClassType
      academicHours: number
      roomId: string
      instructorId: string
      dayOfWeek: DayOfWeek
      startTime: string
      endTime: string
      semester: number
      academicYear: string
      weekType?: WeekType
    }

    if (!curriculumEntryId || !classType || !academicHours || !roomId || !instructorId || !dayOfWeek || !startTime || !endTime || !semester || !academicYear) {
      return res.status(400).json({ error: 'Brakujące wymagane pola' })
    }

    const currEntry = await prisma.curriculumEntry.findUnique({ where: { id: curriculumEntryId } })
    if (!currEntry) return res.status(404).json({ error: 'Wpis siatki godzin nie znaleziony' })

    const dto: ScheduleDto = { curriculumEntryId, classType, academicHours, roomId, instructorId, dayOfWeek, startTime, endTime, semester, academicYear }
    const validationError = await validateScheduleEntry(dto)

    if (validationError) {
      const statusCode =
        validationError.code === 'HOURS_EXCEEDED' ? 422 :
        validationError.code === 'WRONG_ROOM_TYPE' ? 400 : 409
      return res.status(statusCode).json({ error: validationError.code, details: validationError.details })
    }

    const data = await prisma.scheduleEntry.create({
      data: {
        curriculumEntryId,
        classType,
        academicHours,
        roomId,
        instructorId,
        dayOfWeek,
        startTime,
        endTime,
        semester,
        academicYear,
        weekType: weekType ?? 'EVERY',
      },
      include: scheduleInclude,
    })
    res.status(201).json({ data, message: 'Zajęcia dodane do planu' })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const {
      classType,
      academicHours,
      roomId,
      instructorId,
      dayOfWeek,
      startTime,
      endTime,
      semester,
      academicYear,
      weekType,
    } = req.body as Partial<{
      classType: ClassType
      academicHours: number
      roomId: string
      instructorId: string
      dayOfWeek: DayOfWeek
      startTime: string
      endTime: string
      semester: number
      academicYear: string
      weekType: WeekType
    }>

    const existing = await prisma.scheduleEntry.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Wpis planu nie znaleziony' })

    // Buduj pełny DTO z istniejących + nowych wartości do rewalidacji
    const dto: ScheduleDto = {
      curriculumEntryId: existing.curriculumEntryId,
      classType: classType ?? existing.classType,
      academicHours: academicHours ?? existing.academicHours,
      roomId: roomId ?? existing.roomId,
      instructorId: instructorId ?? existing.instructorId,
      dayOfWeek: dayOfWeek ?? existing.dayOfWeek,
      startTime: startTime ?? existing.startTime,
      endTime: endTime ?? existing.endTime,
      semester: semester ?? existing.semester,
      academicYear: academicYear ?? existing.academicYear,
      excludeId: req.params.id,
    }

    const validationError = await validateScheduleEntry(dto)
    if (validationError) {
      const statusCode =
        validationError.code === 'HOURS_EXCEEDED' ? 422 :
        validationError.code === 'WRONG_ROOM_TYPE' ? 400 : 409
      return res.status(statusCode).json({ error: validationError.code, details: validationError.details })
    }

    const data = await prisma.scheduleEntry.update({
      where: { id: req.params.id },
      data: { classType, academicHours, roomId, instructorId, dayOfWeek, startTime, endTime, semester, academicYear, weekType },
      include: scheduleInclude,
    })
    res.json({ data, message: 'Wpis zaktualizowany' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Wpis planu nie znaleziony' })
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    await prisma.scheduleEntry.delete({ where: { id: req.params.id } })
    res.json({ message: 'Wpis usunięty' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Wpis planu nie znaleziony' })
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const getSummary = async (req: Request, res: Response) => {
  try {
    const { curriculumVersionId } = req.params

    const curriculumEntries = await prisma.curriculumEntry.findMany({
      where: { curriculumVersionId },
      include: {
        subject: { select: { name: true } },
        scheduleEntries: { select: { classType: true, academicHours: true } },
      },
      orderBy: [{ semester: 'asc' }, { orderInSemester: 'asc' }],
    })

    if (curriculumEntries.length === 0) {
      return res.status(404).json({ error: 'Wersja planu nie istnieje lub jest pusta' })
    }

    type SubjectProgress = {
      subjectName: string
      classType: string
      planned: number
      required: number
      remaining: number
      completed: boolean
    }

    const semesterMap = new Map<number, SubjectProgress[]>()

    for (const entry of curriculumEntries) {
      const sem = entry.semester
      if (!semesterMap.has(sem)) semesterMap.set(sem, [])

      const classTypes: Array<{ type: ClassType; required: number }> = [
        { type: ClassType.LECTURE,  required: entry.hoursLecture },
        { type: ClassType.EXERCISE, required: entry.hoursExercise },
        { type: ClassType.LAB,      required: entry.hoursLab },
        { type: ClassType.PROJECT,  required: entry.hoursProject },
        { type: ClassType.SEMINAR,  required: entry.hoursSeminar },
      ].filter((ct) => ct.required > 0)

      for (const { type, required } of classTypes) {
        const planned = entry.scheduleEntries
          .filter((se) => se.classType === type)
          .reduce((sum, se) => sum + se.academicHours, 0)

        semesterMap.get(sem)!.push({
          subjectName: entry.subject.name,
          classType: type,
          planned,
          required,
          remaining: required - planned,
          completed: planned >= required,
        })
      }
    }

    const semesters = Array.from(semesterMap.entries()).map(([semester, subjects]) => ({
      semester,
      subjects,
    }))

    res.json({ data: { semesters } })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}
