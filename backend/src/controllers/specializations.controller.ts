import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { isUniqueConstraintError, isNotFoundError } from '../lib/prismaErrors'

export const getAll = async (req: Request, res: Response) => {
  try {
    const { fieldOfStudyId } = req.query
    const data = await prisma.specialization.findMany({
      where: fieldOfStudyId ? { fieldOfStudyId: String(fieldOfStudyId) } : undefined,
      include: { fieldOfStudy: { include: { faculty: true } } },
      orderBy: { name: 'asc' },
    })
    res.json({ data })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const data = await prisma.specialization.findUnique({
      where: { id: req.params.id },
      include: { fieldOfStudy: true, curriculumVersions: true },
    })
    if (!data) return res.status(404).json({ error: 'Specjalność nie znaleziona' })
    res.json({ data })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const { name, shortName, fieldOfStudyId } = req.body as {
      name: string
      shortName: string
      fieldOfStudyId: string
    }
    if (!name || !shortName || !fieldOfStudyId) {
      return res.status(400).json({ error: 'Pola name, shortName i fieldOfStudyId są wymagane' })
    }
    const data = await prisma.specialization.create({ data: { name, shortName, fieldOfStudyId } })
    res.status(201).json({ data, message: 'Specjalność utworzona' })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Specjalność o tej nazwie już istnieje w tym kierunku' })
    }
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const { name, shortName } = req.body as { name?: string; shortName?: string }
    const data = await prisma.specialization.update({
      where: { id: req.params.id },
      data: { name, shortName },
    })
    res.json({ data, message: 'Specjalność zaktualizowana' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Specjalność nie znaleziona' })
    if (isUniqueConstraintError(error)) return res.status(409).json({ error: 'Nazwa już zajęta' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const spec = await prisma.specialization.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { curriculumVersions: true } } },
    })
    if (!spec) return res.status(404).json({ error: 'Specjalność nie znaleziona' })
    if (spec._count.curriculumVersions > 0) {
      return res.status(409).json({ error: 'Nie można usunąć specjalności z przypisanymi wersjami planu' })
    }
    await prisma.specialization.delete({ where: { id: req.params.id } })
    res.json({ message: 'Specjalność usunięta' })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}
