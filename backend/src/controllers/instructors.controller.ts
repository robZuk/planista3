import { Request, Response } from 'express'
import prisma from '../lib/prisma'
import { isUniqueConstraintError, isNotFoundError } from '../lib/prismaErrors'

export const getAll = async (req: Request, res: Response) => {
  try {
    const { facultyId } = req.query
    const data = await prisma.instructor.findMany({
      where: facultyId ? { facultyId: String(facultyId) } : undefined,
      include: { faculty: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
    res.json({ data })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const data = await prisma.instructor.findUnique({
      where: { id: req.params.id },
      include: { faculty: true },
    })
    if (!data) return res.status(404).json({ error: 'Prowadzący nie znaleziony' })
    res.json({ data })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, title, facultyId } = req.body as {
      firstName: string
      lastName: string
      email: string
      title?: string
      facultyId?: string
    }
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'Pola firstName, lastName i email są wymagane' })
    }
    const data = await prisma.instructor.create({
      data: { firstName, lastName, email, title, facultyId },
    })
    res.status(201).json({ data, message: 'Prowadzący utworzony' })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Prowadzący z tym e-mailem już istnieje' })
    }
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, title, facultyId } = req.body as {
      firstName?: string
      lastName?: string
      email?: string
      title?: string
      facultyId?: string
    }
    const data = await prisma.instructor.update({
      where: { id: req.params.id },
      data: { firstName, lastName, email, title, facultyId },
    })
    res.json({ data, message: 'Prowadzący zaktualizowany' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Prowadzący nie znaleziony' })
    if (isUniqueConstraintError(error)) return res.status(409).json({ error: 'E-mail już zajęty' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    await prisma.instructor.delete({ where: { id: req.params.id } })
    res.json({ message: 'Prowadzący usunięty' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Prowadzący nie znaleziony' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}
