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
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const data = await prisma.semesterCalendar.findUnique({ where: { id: req.params.id } })
    if (!data) return res.status(404).json({ error: 'Kalendarz nie znaleziony' })
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const { academicYear, semesterType, studyMode, startDate, endDate, teachingWeeks } = req.body as {
      academicYear: string
      semesterType: SemesterType
      studyMode: StudyMode
      startDate: string
      endDate: string
      teachingWeeks: number
    }

    if (!academicYear || !semesterType || !studyMode || !startDate || !endDate || teachingWeeks === undefined) {
      return res.status(400).json({ error: 'Brakujące wymagane pola' })
    }

    const data = await prisma.semesterCalendar.create({
      data: {
        academicYear,
        semesterType,
        studyMode,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        teachingWeeks,
      },
    })
    res.status(201).json({ data, message: 'Kalendarz semestru utworzony' })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'Kalendarz dla tego semestru i trybu już istnieje' })
    }
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, teachingWeeks } = req.body as Partial<{
      startDate: string
      endDate: string
      teachingWeeks: number
    }>

    const data = await prisma.semesterCalendar.update({
      where: { id: req.params.id },
      data: {
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
        ...(teachingWeeks !== undefined ? { teachingWeeks } : {}),
      },
    })
    res.json({ data, message: 'Kalendarz zaktualizowany' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Kalendarz nie znaleziony' })
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    await prisma.semesterCalendar.delete({ where: { id: req.params.id } })
    res.json({ message: 'Kalendarz usunięty' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Kalendarz nie znaleziony' })
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}
