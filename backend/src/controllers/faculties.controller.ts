import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { isUniqueConstraintError, isNotFoundError } from '../lib/prismaErrors'

export const getAll = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.faculty.findMany({ orderBy: { name: 'asc' } })
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const data = await prisma.faculty.findUnique({
      where: { id: req.params.id },
      include: { fieldsOfStudy: true, buildings: true, instructors: true },
    })
    if (!data) return res.status(404).json({ error: 'Wydział nie znaleziony' })
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const { name, shortName } = req.body as { name: string; shortName: string }
    if (!name || !shortName) {
      return res.status(400).json({ error: 'Pola name i shortName są wymagane' })
    }
    const data = await prisma.faculty.create({ data: { name, shortName } })
    res.status(201).json({ data, message: 'Wydział utworzony' })
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Wydział o tej nazwie lub skrócie już istnieje' })
    }
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const { name, shortName } = req.body as { name?: string; shortName?: string }
    const data = await prisma.faculty.update({
      where: { id: req.params.id },
      data: { name, shortName },
    })
    res.json({ data, message: 'Wydział zaktualizowany' })
  } catch (error: unknown) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Wydział nie znaleziony' })
    if (isUniqueConstraintError(error)) return res.status(409).json({ error: 'Nazwa lub skrót już zajęte' })
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const faculty = await prisma.faculty.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { fieldsOfStudy: true } } },
    })
    if (!faculty) return res.status(404).json({ error: 'Wydział nie znaleziony' })
    if (faculty._count.fieldsOfStudy > 0) {
      return res.status(409).json({ error: 'Nie można usunąć wydziału z przypisanymi kierunkami' })
    }
    await prisma.faculty.delete({ where: { id: req.params.id } })
    res.json({ message: 'Wydział usunięty' })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

