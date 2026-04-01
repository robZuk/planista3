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
        ...(from ? { date: { gte: new Date(String(from) + 'T00:00:00.000Z') } } : {}),
        ...(to ? { date: { lte: new Date(String(to) + 'T23:59:59.999Z') } } : {}),
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
    const { from, to, studentGroupId, instructorId, templateId } = req.query
    const { count } = await prisma.scheduleEntry.deleteMany({
      where: {
        ...(from ? { date: { gte: new Date(String(from) + 'T00:00:00.000Z') } } : {}),
        ...(to ? { date: { lte: new Date(String(to) + 'T23:59:59.999Z') } } : {}),
        ...(studentGroupId ? { studentGroupId: String(studentGroupId) } : {}),
        ...(instructorId ? { instructorId: String(instructorId) } : {}),
        ...(templateId ? { templateId: String(templateId) } : {}),
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

    if (scope === 'ONE') {
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

    const fromDate = new Date(existing.date)
    fromDate.setUTCHours(0, 0, 0, 0)

    const futureEntries = await prisma.scheduleEntry.findMany({
      where: {
        templateId: existing.templateId,
        date: { gte: fromDate },
        status: { not: 'CANCELLED' },
      },
      orderBy: { date: 'asc' },
    })

    const targetDayNum = targetDate.getUTCDay()
    const futureIds = futureEntries.map(e => e.id)
    const futureDates = futureEntries.map(entry => {
      const d = new Date(entry.date)
      d.setUTCDate(d.getUTCDate() + (targetDayNum - d.getUTCDay()))
      d.setUTCHours(0, 0, 0, 0)
      return d
    })

    // Walidacja kolizji dla wszystkich przyszłych dat jednym zapytaniem per typ
    const roomConflict = await prisma.scheduleEntry.findFirst({
      where: {
        roomId: targetRoomId,
        date: { in: futureDates },
        AND: [{ startTime: { lt: newEndTime } }, { endTime: { gt: newStartTime } }],
        id: { notIn: futureIds },
      },
    })
    if (roomConflict) {
      return res.status(409).json({
        error: 'ROOM_CONFLICT',
        details: { conflictId: roomConflict.id, date: roomConflict.date.toISOString(), startTime: roomConflict.startTime, endTime: roomConflict.endTime },
      })
    }

    const instructorConflict = await prisma.scheduleEntry.findFirst({
      where: {
        instructorId: targetInstructorId,
        date: { in: futureDates },
        AND: [{ startTime: { lt: newEndTime } }, { endTime: { gt: newStartTime } }],
        id: { notIn: futureIds },
      },
    })
    if (instructorConflict) {
      return res.status(409).json({
        error: 'INSTRUCTOR_CONFLICT',
        details: { conflictId: instructorConflict.id, date: instructorConflict.date.toISOString(), startTime: instructorConflict.startTime, endTime: instructorConflict.endTime },
      })
    }

    if (existing.studentGroupId) {
      const groupConflict = await prisma.scheduleEntry.findFirst({
        where: {
          studentGroupId: existing.studentGroupId,
          date: { in: futureDates },
          AND: [{ startTime: { lt: newEndTime } }, { endTime: { gt: newStartTime } }],
          id: { notIn: futureIds },
        },
      })
      if (groupConflict) {
        return res.status(409).json({
          error: 'GROUP_CONFLICT',
          details: { conflictId: groupConflict.id, date: groupConflict.date.toISOString(), startTime: groupConflict.startTime, endTime: groupConflict.endTime },
        })
      }
    }

    const dayMap: Record<number, 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'> = {
      1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY',
      5: 'FRIDAY', 6: 'SATURDAY', 0: 'SUNDAY',
    }
    const newDayOfWeek = dayMap[targetDate.getUTCDay()]

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

    const updated = await Promise.all(
      futureEntries.map((entry, i) =>
        prisma.scheduleEntry.update({
          where: { id: entry.id },
          data: {
            date: futureDates[i],
            startTime: newStartTime,
            endTime: newEndTime,
            ...(newRoomId ? { roomId: newRoomId } : {}),
            ...(newInstructorId ? { instructorId: newInstructorId } : {}),
          },
        })
      )
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
