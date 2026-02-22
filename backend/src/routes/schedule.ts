import { Router } from 'express'
import { getAll, getOne, create, update, remove, getSummary } from '../controllers/schedule.controller'
import { authenticate, authorize } from '../middleware/authenticate'

const router = Router()

// Odczyt — wszyscy zalogowani
router.get('/', authenticate, getAll)
router.get('/summary/:curriculumVersionId', authenticate, getSummary)
router.get('/:id', authenticate, getOne)

// Zapis — ADMIN lub INSTRUCTOR (prowadzący może zarządzać własnymi zajęciami)
router.post('/', authenticate, authorize('ADMIN', 'INSTRUCTOR'), create)
router.put('/:id', authenticate, authorize('ADMIN', 'INSTRUCTOR'), update)

// Usuwanie — tylko ADMIN
router.delete('/:id', authenticate, authorize('ADMIN'), remove)

export default router
