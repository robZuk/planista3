import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { isUniqueConstraintError, isNotFoundError } from '../lib/prismaErrors'

export const getAll = async (req: Request, res: Response) => {
  try {
    const { search } = req.query
    const data = await prisma.subject.findMany({
      where: search
        ? { name: { contains: String(search), mode: 'insensitive' } }
        : undefined,
      orderBy: { name: 'asc' },
    })
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const data = await prisma.subject.findUnique({ where: { id: req.params.id } })
    if (!data) return res.status(404).json({ error: 'Przedmiot nie znaleziony' })
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const { name, code } = req.body as { name: string; code?: string }
    if (!name) return res.status(400).json({ error: 'Pole name jest wymagane' })
    const data = await prisma.subject.create({ data: { name, code } })
    res.status(201).json({ data, message: 'Przedmiot utworzony' })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Przedmiot o tej nazwie lub kodzie już istnieje' })
    }
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const { name, code } = req.body as { name?: string; code?: string }
    const data = await prisma.subject.update({
      where: { id: req.params.id },
      data: { name, code },
    })
    res.json({ data, message: 'Przedmiot zaktualizowany' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Przedmiot nie znaleziony' })
    if (isUniqueConstraintError(error)) return res.status(409).json({ error: 'Nazwa lub kod już zajęte' })
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const subject = await prisma.subject.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { entries: true } } },
    })
    if (!subject) return res.status(404).json({ error: 'Przedmiot nie znaleziony' })
    if (subject._count.entries > 0) {
      return res.status(409).json({ error: 'Nie można usunąć przedmiotu używanego w siatce godzin' })
    }
    await prisma.subject.delete({ where: { id: req.params.id } })
    res.json({ message: 'Przedmiot usunięty' })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}
