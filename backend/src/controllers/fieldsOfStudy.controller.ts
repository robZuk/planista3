import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { isUniqueConstraintError, isNotFoundError } from '../lib/prismaErrors'

export const getAll = async (req: Request, res: Response) => {
  try {
    const { facultyId } = req.query
    const data = await prisma.fieldOfStudy.findMany({
      where: facultyId ? { facultyId: String(facultyId) } : undefined,
      include: { faculty: true },
      orderBy: { name: 'asc' },
    })
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const data = await prisma.fieldOfStudy.findUnique({
      where: { id: req.params.id },
      include: { faculty: true, specializations: true },
    })
    if (!data) return res.status(404).json({ error: 'Kierunek nie znaleziony' })
    res.json({ data })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const { name, shortName, facultyId } = req.body as {
      name: string
      shortName: string
      facultyId: string
    }
    if (!name || !shortName || !facultyId) {
      return res.status(400).json({ error: 'Pola name, shortName i facultyId są wymagane' })
    }
    const data = await prisma.fieldOfStudy.create({ data: { name, shortName, facultyId } })
    res.status(201).json({ data, message: 'Kierunek utworzony' })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Kierunek o tej nazwie już istnieje w tym wydziale' })
    }
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const { name, shortName } = req.body as { name?: string; shortName?: string }
    const data = await prisma.fieldOfStudy.update({
      where: { id: req.params.id },
      data: { name, shortName },
    })
    res.json({ data, message: 'Kierunek zaktualizowany' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Kierunek nie znaleziony' })
    if (isUniqueConstraintError(error)) return res.status(409).json({ error: 'Nazwa już zajęta' })
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const field = await prisma.fieldOfStudy.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { specializations: true } } },
    })
    if (!field) return res.status(404).json({ error: 'Kierunek nie znaleziony' })
    if (field._count.specializations > 0) {
      return res.status(409).json({ error: 'Nie można usunąć kierunku z przypisanymi specjalnościami' })
    }
    await prisma.fieldOfStudy.delete({ where: { id: req.params.id } })
    res.json({ message: 'Kierunek usunięty' })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}
