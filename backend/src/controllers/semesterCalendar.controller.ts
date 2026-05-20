import { Request, Response } from 'express'
import { SemesterType, StudyMode } from '@prisma/client'
import prisma from '../lib/prisma'
import { isNotFoundError } from '../lib/prismaErrors'

export const getAll = async (req: Request, res: Response) => {
  try {
    const data = await prisma.semesterCalendar.findMany({
      orderBy: [{ academicYear: 'asc' }, { semesterType: 'asc' }],
    })
    res.json({ data })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const data = await prisma.semesterCalendar.findUnique({ where: { id: req.params.id } })
    if (!data) return res.status(404).json({ error: 'Kalendarz nie znaleziony' })
    res.json({ data })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const { academicYear, semesterType, studyMode, startDate, endDate } = req.body as {
      academicYear: string
      semesterType: SemesterType
      studyMode: StudyMode
      startDate: string
      endDate: string
    }

    if (!academicYear || !semesterType || !studyMode || !startDate || !endDate) {
      return res.status(400).json({ error: 'Brakujące wymagane pola' })
    }

    const data = await prisma.semesterCalendar.create({
      data: {
        academicYear,
        semesterType,
        studyMode,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        teachingWeeks: 0,
      },
    })
    res.status(201).json({ data, message: 'Kalendarz semestru utworzony' })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'Kalendarz dla tego semestru i trybu już istnieje' })
    }
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body as Partial<{ startDate: string; endDate: string }>

    const current = await prisma.semesterCalendar.findUnique({ where: { id: req.params.id } })
    if (!current) return res.status(404).json({ error: 'Kalendarz nie znaleziony' })

    const newStart = startDate ? new Date(startDate) : current.startDate
    const newEnd = endDate ? new Date(endDate) : current.endDate

    const shrinkingStart = newStart > current.startDate
    const shrinkingEnd = newEnd < current.endDate

    if (shrinkingStart || shrinkingEnd) {
      const cutEntry = await prisma.scheduleEntry.findFirst({
        where: {
          status: { not: 'CANCELLED' },
          OR: [
            ...(shrinkingStart ? [{ date: { gte: current.startDate, lt: newStart } }] : []),
            ...(shrinkingEnd   ? [{ date: { gt: newEnd, lte: current.endDate } }] : []),
          ],
        },
      })
      if (cutEntry) {
        return res.status(409).json({
          error: 'Nie można skrócić semestru — istnieją zajęcia poza nowym zakresem dat. Usuń je najpierw lub nie zmieniaj zakresu.',
        })
      }
    }

    const data = await prisma.semesterCalendar.update({
      where: { id: req.params.id },
      data: {
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
      },
    })
    res.json({ data, message: 'Kalendarz zaktualizowany' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Kalendarz nie znaleziony' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    await prisma.semesterCalendar.delete({ where: { id: req.params.id } })
    res.json({ message: 'Kalendarz usunięty' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Kalendarz nie znaleziony' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}
