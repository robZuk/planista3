import { Router } from 'express'
import { getAll, getOne, create, update, remove } from '../controllers/instructors.controller'
import { authenticate, authorize } from '../middleware/authenticate'

const router = Router()

router.get('/', authenticate, authorize('ADMIN', 'DEAN_OFFICE', 'INSTRUCTOR'), getAll)
router.get('/:id', authenticate, authorize('ADMIN', 'DEAN_OFFICE', 'INSTRUCTOR'), getOne)
router.post('/', authenticate, authorize('ADMIN'), create)
router.put('/:id', authenticate, authorize('ADMIN'), update)
router.delete('/:id', authenticate, authorize('ADMIN'), remove)

export default router
