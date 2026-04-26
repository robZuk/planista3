import { Request, Response } from 'express'
import { RoomType } from '@prisma/client'
import prisma from '../lib/prisma'
import { isUniqueConstraintError, isNotFoundError } from '../lib/prismaErrors'

// ─── Buildings ───────────────────────────────────────────────

export const getAll = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.building.findMany({
      include: { faculty: true, rooms: true },
      orderBy: { name: 'asc' },
    })
    res.json({ data })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const getOne = async (req: Request, res: Response) => {
  try {
    const data = await prisma.building.findUnique({
      where: { id: req.params.id },
      include: { faculty: true, rooms: true },
    })
    if (!data) return res.status(404).json({ error: 'Budynek nie znaleziony' })
    res.json({ data })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const create = async (req: Request, res: Response) => {
  try {
    const { name, address, facultyId } = req.body as {
      name: string
      address?: string
      facultyId?: string
    }
    if (!name) return res.status(400).json({ error: 'Pole name jest wymagane' })
    const data = await prisma.building.create({ data: { name, address, facultyId } })
    res.status(201).json({ data, message: 'Budynek utworzony' })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Budynek o tej nazwie już istnieje' })
    }
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const update = async (req: Request, res: Response) => {
  try {
    const { name, address, facultyId } = req.body as {
      name?: string
      address?: string
      facultyId?: string
    }
    const data = await prisma.building.update({
      where: { id: req.params.id },
      data: { name, address, facultyId },
    })
    res.json({ data, message: 'Budynek zaktualizowany' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Budynek nie znaleziony' })
    if (isUniqueConstraintError(error)) return res.status(409).json({ error: 'Nazwa już zajęta' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const remove = async (req: Request, res: Response) => {
  try {
    const building = await prisma.building.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { rooms: true } } },
    })
    if (!building) return res.status(404).json({ error: 'Budynek nie znaleziony' })
    if (building._count.rooms > 0) {
      return res.status(409).json({ error: 'Usuń najpierw wszystkie sale w budynku' })
    }
    await prisma.building.delete({ where: { id: req.params.id } })
    res.json({ message: 'Budynek usunięty' })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

// ─── Rooms ───────────────────────────────────────────────────

export const getRooms = async (req: Request, res: Response) => {
  try {
    const data = await prisma.room.findMany({
      where: { buildingId: req.params.id },
      orderBy: { number: 'asc' },
    })
    res.json({ data })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const createRoom = async (req: Request, res: Response) => {
  try {
    const { number, type, capacity } = req.body as {
      number: string
      type: RoomType
      capacity: number
    }
    if (!number || !type || capacity === undefined) {
      return res.status(400).json({ error: 'Pola number, type i capacity są wymagane' })
    }
    const data = await prisma.room.create({
      data: { number, type, capacity, buildingId: req.params.id },
    })
    res.status(201).json({ data, message: 'Sala utworzona' })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Sala o tym numerze już istnieje w budynku' })
    }
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const updateRoom = async (req: Request, res: Response) => {
  try {
    const { number, type, capacity } = req.body as {
      number?: string
      type?: RoomType
      capacity?: number
    }
    const data = await prisma.room.update({
      where: { id: req.params.roomId },
      data: { number, type, capacity },
    })
    res.json({ data, message: 'Sala zaktualizowana' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Sala nie znaleziona' })
    if (isUniqueConstraintError(error)) return res.status(409).json({ error: 'Numer sali już zajęty' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const removeRoom = async (req: Request, res: Response) => {
  try {
    await prisma.room.delete({ where: { id: req.params.roomId } })
    res.json({ message: 'Sala usunięta' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Sala nie znaleziona' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}
