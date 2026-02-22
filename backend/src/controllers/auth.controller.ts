import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma'
import { AuthRequest } from '../middleware/authenticate'
import { Role } from '@prisma/client'

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '24h'
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'

function signAccessToken(userId: string, role: Role, instructorId?: string, studentGroupId?: string): string {
  return jwt.sign(
    { userId, role, instructorId, studentGroupId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  )
}

function signRefreshToken(userId: string): string {
  return jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
  )
}

function refreshExpiresAt(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d
}

// POST /api/auth/register — tylko ADMIN
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role, instructorId, studentGroupId } = req.body as {
      email?: string
      password?: string
      name?: string
      role?: Role
      instructorId?: string
      studentGroupId?: string
    }

    if (!email || !password || !name || !role) {
      res.status(400).json({ error: 'Wymagane pola: email, password, name, role' })
      return
    }

    const validRoles: Role[] = ['ADMIN', 'INSTRUCTOR', 'STUDENT', 'DEAN_OFFICE']
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: `Nieprawidłowa rola. Dozwolone: ${validRoles.join(', ')}` })
      return
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'Użytkownik z tym emailem już istnieje' })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        instructorId: instructorId ?? null,
        studentGroupId: studentGroupId ?? null,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    })

    res.status(201).json({ data: user, message: 'Konto utworzone' })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string }

    if (!email || !password) {
      res.status(400).json({ error: 'Wymagane pola: email, password' })
      return
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      res.status(401).json({ error: 'Nieprawidłowy email lub hasło' })
      return
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      res.status(401).json({ error: 'Nieprawidłowy email lub hasło' })
      return
    }

    const accessToken = signAccessToken(user.id, user.role, user.instructorId ?? undefined, user.studentGroupId ?? undefined)
    const refreshToken = signRefreshToken(user.id)

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshExpiresAt(),
      },
    })

    res.json({
      data: {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
    })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

// POST /api/auth/refresh
export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string }

    if (!refreshToken) {
      res.status(400).json({ error: 'Wymagane pole: refreshToken' })
      return
    }

    let payload: { userId: string }
    try {
      payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string }
    } catch {
      res.status(401).json({ error: 'Refresh token nieważny lub wygasł' })
      return
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } })
    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ error: 'Refresh token nieważny lub wygasł' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user) {
      res.status(401).json({ error: 'Użytkownik nie istnieje' })
      return
    }

    // Obróć stary token
    await prisma.refreshToken.delete({ where: { token: refreshToken } })

    const newAccessToken = signAccessToken(user.id, user.role, user.instructorId ?? undefined, user.studentGroupId ?? undefined)
    const newRefreshToken = signRefreshToken(user.id)

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: refreshExpiresAt(),
      },
    })

    res.json({
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

// POST /api/auth/logout
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string }

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
    }

    res.json({ data: null, message: 'Wylogowano' })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

// GET /api/auth/me
export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        instructorId: true,
        studentGroupId: true,
        createdAt: true,
      },
    })

    if (!user) {
      res.status(404).json({ error: 'Użytkownik nie istnieje' })
      return
    }

    res.json({ data: user })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}
