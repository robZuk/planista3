import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { isNotFoundError } from '../lib/prismaErrors'

export const getAll = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query
    const data = await prisma.publicHoliday.findMany({
      where: {
        ...(from ? { date: { gte: new Date(String(from)) } } : {}),
        ...(to ? { date: { lte: new Date(String(to)) } } : {}),
      },
      orderBy: { date: 'asc' },
    })
    res.json({ data })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const { date, name } = req.body as { date: string; name: string }

    if (!date || !name) {
      return res.status(400).json({ error: 'Brakujące wymagane pola: date, name' })
    }

    const data = await prisma.publicHoliday.create({
      data: { date: new Date(date), name },
    })
    res.status(201).json({ data, message: 'Dzień wolny dodany' })
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return res.status(409).json({ error: 'Ten dzień jest już oznaczony jako wolny' })
    }
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    await prisma.publicHoliday.delete({ where: { id: req.params.id } })
    res.json({ message: 'Dzień wolny usunięty' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Dzień wolny nie znaleziony' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}
