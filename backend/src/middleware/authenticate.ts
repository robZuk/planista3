import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'

export interface AuthRequest extends Request {
  userId?: string
  role?: Role
  instructorId?: string
  studentGroupId?: string
}

interface JwtPayload {
  userId: string
  role: Role
  instructorId?: string
  studentGroupId?: string
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    res.status(401).json({ error: 'Brak tokenu' })
    return
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.userId = payload.userId
    req.role = payload.role
    req.instructorId = payload.instructorId
    req.studentGroupId = payload.studentGroupId
    next()
  } catch {
    res.status(401).json({ error: 'Token nieważny lub wygasł' })
  }
}

export const authorize = (...roles: Role[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.role || !roles.includes(req.role)) {
      res.status(403).json({ error: 'Brak uprawnień' })
      return
    }
    next()
  }
