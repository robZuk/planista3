import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { isNotFoundError } from '../lib/prismaErrors'
import { validateEntryConflicts } from '../services/scheduleValidation'

const entryInclude = {
  room: {
    select: {
      id: true, number: true, type: true,
      building: { select: { id: true, name: true } },
    },
  },
  instructor: { select: { id: true, firstName: true, lastName: true, title: true } },
  studentGroup: { select: { id: true, name: true } },
  curriculumEntry: {
    include: {
      subject: { select: { id: true, name: true } },
    },
  },
  template: { select: { id: true, dayOfWeek: true, weekType: true } },
}

export const getAll = async (req: Request, res: Response) => {
  try {
    const { from, to, studentGroupId, instructorId, status } = req.query

    const data = await prisma.scheduleEntry.findMany({
      where: {
        ...(from ? { date: { gte: new Date(String(from)) } } : {}),
        ...(to ? { date: { lte: new Date(String(to)) } } : {}),
        ...(studentGroupId ? { studentGroupId: String(studentGroupId) } : {}),
        ...(instructorId ? { instructorId: String(instructorId) } : {}),
        ...(status ? { status: status as 'SCHEDULED' | 'CANCELLED' | 'MAKEUP' } : {}),
      },
      include: entryInclude,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
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
      include: entryInclude,
    })
    if (!data) return res.status(404).json({ error: 'Wpis nie znaleziony' })
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const {
      date, startTime, endTime, classType, academicHours,
      roomId, instructorId, curriculumEntryId, studentGroupId, templateId, status,
    } = req.body as {
      date: string
      startTime: string
      endTime: string
      classType: 'LECTURE' | 'EXERCISE' | 'LAB' | 'PROJECT' | 'SEMINAR'
      academicHours: number
      roomId: string
      instructorId: string
      curriculumEntryId: string
      studentGroupId?: string
      templateId?: string
      status?: 'SCHEDULED' | 'CANCELLED' | 'MAKEUP'
    }

    if (!date || !startTime || !endTime || !classType || !academicHours || !roomId || !instructorId || !curriculumEntryId) {
      return res.status(400).json({ error: 'Brakujące wymagane pola' })
    }

    const conflict = await validateEntryConflicts({
      date: new Date(date),
      startTime,
      endTime,
      roomId,
      instructorId,
      studentGroupId,
      curriculumEntryId,
      classType,
      academicHours,
    })
    if (conflict) {
      return res.status(409).json({ error: conflict.code, details: conflict.details })
    }

    const data = await prisma.scheduleEntry.create({
      data: {
        date: new Date(date),
        startTime,
        endTime,
        classType,
        academicHours,
        roomId,
        instructorId,
        curriculumEntryId,
        studentGroupId: studentGroupId ?? null,
        templateId: templateId ?? null,
        status: status ?? 'SCHEDULED',
      },
      include: entryInclude,
    })
    res.status(201).json({ data, message: 'Wpis dodany' })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const { roomId, instructorId, date, startTime, endTime, status } = req.body as Partial<{
      roomId: string
      instructorId: string
      date: string
      startTime: string
      endTime: string
      status: 'SCHEDULED' | 'CANCELLED' | 'MAKEUP'
    }>

    const existing = await prisma.scheduleEntry.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Wpis nie znaleziony' })

    if (roomId || instructorId || date || startTime || endTime) {
      const conflict = await validateEntryConflicts({
        date: date ? new Date(date) : existing.date,
        startTime: startTime ?? existing.startTime,
        endTime: endTime ?? existing.endTime,
        roomId: roomId ?? existing.roomId,
        instructorId: instructorId ?? existing.instructorId,
        studentGroupId: existing.studentGroupId,
        excludeId: req.params.id,
      })
      if (conflict) {
        return res.status(409).json({ error: conflict.code, details: conflict.details })
      }
    }

    const data = await prisma.scheduleEntry.update({
      where: { id: req.params.id },
      data: {
        ...(roomId ? { roomId } : {}),
        ...(instructorId ? { instructorId } : {}),
        ...(date ? { date: new Date(date) } : {}),
        ...(startTime ? { startTime } : {}),
        ...(endTime ? { endTime } : {}),
        ...(status ? { status } : {}),
      },
      include: entryInclude,
    })
    res.json({ data, message: 'Wpis zaktualizowany' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Wpis nie znaleziony' })
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const { cancel } = req.query
    if (cancel === 'true') {
      const data = await prisma.scheduleEntry.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED' },
        include: entryInclude,
      })
      return res.json({ data, message: 'Zajęcia odwołane' })
    }
    await prisma.scheduleEntry.delete({ where: { id: req.params.id } })
    res.json({ message: 'Wpis usunięty' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Wpis nie znaleziony' })
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const removeMany = async (req: Request, res: Response) => {
  try {
    const { from, to, studentGroupId, instructorId } = req.query
    const { count } = await prisma.scheduleEntry.deleteMany({
      where: {
        ...(from ? { date: { gte: new Date(String(from)) } } : {}),
        ...(to ? { date: { lte: new Date(String(to)) } } : {}),
        ...(studentGroupId ? { studentGroupId: String(studentGroupId) } : {}),
        ...(instructorId ? { instructorId: String(instructorId) } : {}),
      },
    })
    res.json({ data: { deleted: count } })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const move = async (req: Request, res: Response) => {
  try {
    const { newDate, newStartTime, newEndTime, newRoomId, newInstructorId, scope } = req.body as {
      newDate: string
      newStartTime: string
      newEndTime: string
      newRoomId?: string
      newInstructorId?: string
      scope: 'ONE' | 'ALL'
    }

    if (!newDate || !newStartTime || !newEndTime || !scope) {
      return res.status(400).json({ error: 'Brakujące wymagane pola: newDate, newStartTime, newEndTime, scope' })
    }

    const existing = await prisma.scheduleEntry.findUnique({
      where: { id: req.params.id },
      include: { template: true },
    })
    if (!existing) return res.status(404).json({ error: 'Wpis nie znaleziony' })

    const targetDate = new Date(newDate)
    const targetRoomId = newRoomId ?? existing.roomId
    const targetInstructorId = newInstructorId ?? existing.instructorId

    const conflict = await validateEntryConflicts({
      date: targetDate,
      startTime: newStartTime,
      endTime: newEndTime,
      roomId: targetRoomId,
      instructorId: targetInstructorId,
      studentGroupId: existing.studentGroupId,
      excludeId: req.params.id,
    })
    if (conflict) {
      return res.status(409).json({ error: conflict.code, details: conflict.details })
    }

    if (scope === 'ONE') {
      const data = await prisma.scheduleEntry.update({
        where: { id: req.params.id },
        data: {
          date: targetDate,
          startTime: newStartTime,
          endTime: newEndTime,
          roomId: targetRoomId,
          instructorId: targetInstructorId,
        },
        include: entryInclude,
      })
      return res.json({ data, message: 'Przeniesiono jeden wpis' })
    }

    // scope === 'ALL': zaktualizuj szablon + wszystkie przyszłe wpisy
    if (!existing.templateId) {
      return res.status(400).json({ error: 'Brak szablonu — nie można zmienić wszystkich terminów' })
    }

    const dayMap: Record<number, 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'> = {
      1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY',
      5: 'FRIDAY', 6: 'SATURDAY', 0: 'SUNDAY',
    }
    const newDayOfWeek = dayMap[targetDate.getDay()]

    await prisma.scheduleTemplate.update({
      where: { id: existing.templateId },
      data: {
        dayOfWeek: newDayOfWeek,
        startTime: newStartTime,
        endTime: newEndTime,
        ...(newRoomId ? { roomId: newRoomId } : {}),
        ...(newInstructorId ? { instructorId: newInstructorId } : {}),
      },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const futureEntries = await prisma.scheduleEntry.findMany({
      where: {
        templateId: existing.templateId,
        date: { gte: today },
        status: { not: 'CANCELLED' },
      },
      orderBy: { date: 'asc' },
    })

    const targetDayNum = targetDate.getDay()
    const updated = await Promise.all(
      futureEntries.map(async (entry) => {
        const entryDate = new Date(entry.date)
        const currentDay = entryDate.getDay()
        const diff = targetDayNum - currentDay
        const newEntryDate = new Date(entryDate)
        newEntryDate.setDate(newEntryDate.getDate() + diff)

        return prisma.scheduleEntry.update({
          where: { id: entry.id },
          data: {
            date: newEntryDate,
            startTime: newStartTime,
            endTime: newEndTime,
            ...(newRoomId ? { roomId: newRoomId } : {}),
            ...(newInstructorId ? { instructorId: newInstructorId } : {}),
          },
        })
      })
    )

    res.json({
      data: { updatedCount: updated.length },
      message: `Zaktualizowano szablon i ${updated.length} przyszłych wpisów`,
    })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Wpis nie znaleziony' })
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}
