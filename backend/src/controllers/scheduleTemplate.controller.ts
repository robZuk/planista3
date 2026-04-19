import { Request, Response } from 'express'
import { ClassType, WeekType, DayOfWeek, StudyMode } from '@prisma/client'
import prisma from '../lib/prisma'
import { isNotFoundError } from '../lib/prismaErrors'
import { validateTemplateEntry, TemplateDto } from '../services/scheduleValidation'

const templateInclude = {
  curriculumEntry: {
    include: {
      subject: { select: { id: true, name: true } },
    },
  },
  room: {
    select: {
      id: true, number: true, type: true, capacity: true,
      building: { select: { id: true, name: true } },
    },
  },
  instructor: { select: { id: true, firstName: true, lastName: true, title: true } },
  studentGroup: { select: { id: true, name: true } },
}

export const getAll = async (req: Request, res: Response) => {
  try {
    const { semester, semesterType, academicYear, studyMode, studentGroupId } = req.query
    const semesterFilter = semester
      ? { semester: Number(semester) }
      : semesterType === 'WINTER'
        ? { semester: { in: [1, 3, 5, 7] } }
        : semesterType === 'SUMMER'
          ? { semester: { in: [2, 4, 6] } }
          : {}
    const data = await prisma.scheduleTemplate.findMany({
      where: {
        ...semesterFilter,
        ...(academicYear ? { academicYear: String(academicYear) } : {}),
        ...(studyMode ? { studyMode: studyMode as StudyMode } : {}),
        ...(studentGroupId ? { studentGroupId: String(studentGroupId) } : {}),
      },
      include: templateInclude,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const data = await prisma.scheduleTemplate.findUnique({
      where: { id: req.params.id },
      include: templateInclude,
    })
    if (!data) return res.status(404).json({ error: 'Szablon nie znaleziony' })
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const {
      curriculumEntryId, classType, academicHours, roomId, instructorId,
      studentGroupId, dayOfWeek, startTime, endTime, semester, academicYear,
      weekType, studyMode,
    } = req.body as {
      curriculumEntryId: string
      classType: ClassType
      academicHours: number
      roomId: string
      instructorId: string
      studentGroupId?: string
      dayOfWeek: DayOfWeek
      startTime: string
      endTime: string
      semester: number
      academicYear: string
      weekType?: WeekType
      studyMode?: StudyMode
    }

    if (!curriculumEntryId || !classType || !academicHours || !roomId || !instructorId || !dayOfWeek || !startTime || !endTime || !semester || !academicYear) {
      return res.status(400).json({ error: 'Brakujące wymagane pola' })
    }

    const currEntry = await prisma.curriculumEntry.findUnique({ where: { id: curriculumEntryId } })
    if (!currEntry) return res.status(404).json({ error: 'Wpis siatki godzin nie znaleziony' })

    const dto: TemplateDto = { curriculumEntryId, classType, academicHours, roomId, instructorId, studentGroupId, dayOfWeek, startTime, endTime, semester, academicYear, weekType: weekType ?? 'EVERY', studyMode: studyMode ?? 'FULL_TIME' }
    const validationError = await validateTemplateEntry(dto)
    if (validationError) {
      const statusCode = validationError.code === 'WRONG_ROOM_TYPE' || validationError.code === 'TIME_WINDOW_VIOLATION' ? 400 : 409
      return res.status(statusCode).json({ error: validationError.code, details: validationError.details })
    }

    const data = await prisma.scheduleTemplate.create({
      data: {
        curriculumEntryId, classType, academicHours, roomId, instructorId,
        studentGroupId: studentGroupId ?? null, dayOfWeek, startTime, endTime,
        semester, academicYear, weekType: weekType ?? 'EVERY', studyMode: studyMode ?? 'FULL_TIME',
      },
      include: templateInclude,
    })
    res.status(201).json({ data, message: 'Szablon zajęć dodany' })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const {
      classType, academicHours, roomId, instructorId, studentGroupId,
      dayOfWeek, startTime, endTime, semester, academicYear, weekType, studyMode,
    } = req.body as Partial<{
      classType: ClassType; academicHours: number; roomId: string; instructorId: string
      studentGroupId: string | null; dayOfWeek: DayOfWeek; startTime: string; endTime: string
      semester: number; academicYear: string; weekType: WeekType; studyMode: StudyMode
    }>

    const existing = await prisma.scheduleTemplate.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Szablon nie znaleziony' })

    const dto: TemplateDto = {
      curriculumEntryId: existing.curriculumEntryId,
      classType: classType ?? existing.classType,
      academicHours: academicHours ?? existing.academicHours,
      roomId: roomId ?? existing.roomId,
      instructorId: instructorId ?? existing.instructorId,
      studentGroupId: studentGroupId !== undefined ? studentGroupId : existing.studentGroupId,
      dayOfWeek: dayOfWeek ?? existing.dayOfWeek,
      startTime: startTime ?? existing.startTime,
      endTime: endTime ?? existing.endTime,
      semester: semester ?? existing.semester,
      academicYear: academicYear ?? existing.academicYear,
      weekType: weekType ?? existing.weekType,
      studyMode: studyMode ?? existing.studyMode,
      excludeId: req.params.id,
    }

    const validationError = await validateTemplateEntry(dto)
    if (validationError) {
      const statusCode = validationError.code === 'WRONG_ROOM_TYPE' || validationError.code === 'TIME_WINDOW_VIOLATION' ? 400 : 409
      return res.status(statusCode).json({ error: validationError.code, details: validationError.details })
    }

    const data = await prisma.scheduleTemplate.update({
      where: { id: req.params.id },
      data: {
        classType, academicHours, roomId, instructorId,
        ...(studentGroupId !== undefined ? { studentGroupId } : {}),
        dayOfWeek, startTime, endTime, semester, academicYear, weekType, studyMode,
      },
      include: templateInclude,
    })
    res.json({ data, message: 'Szablon zaktualizowany' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Szablon nie znaleziony' })
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    await prisma.scheduleTemplate.delete({ where: { id: req.params.id } })
    res.json({ message: 'Szablon usunięty' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Szablon nie znaleziony' })
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const removeMany = async (req: Request, res: Response) => {
  try {
    const { semester, academicYear, studyMode } = req.query
    const { count } = await prisma.scheduleTemplate.deleteMany({
      where: {
        ...(semester ? { semester: Number(semester) } : {}),
        ...(academicYear ? { academicYear: String(academicYear) } : {}),
        ...(studyMode ? { studyMode: studyMode as 'FULL_TIME' | 'PART_TIME' } : {}),
      },
    })
    res.json({ data: { deleted: count } })
  } catch (error) {
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
        templateEntries: { select: { classType: true, academicHours: true } },
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
        const planned = entry.templateEntries
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
