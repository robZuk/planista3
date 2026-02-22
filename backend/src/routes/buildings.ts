import { Router } from 'express'
import {
  getAll,
  getOne,
  create,
  update,
  remove,
  getRooms,
  createRoom,
  updateRoom,
  removeRoom,
} from '../controllers/buildings.controller'
import { authenticate, authorize } from '../middleware/authenticate'

const router = Router()

router.get('/', authenticate, authorize('ADMIN', 'DEAN_OFFICE', 'INSTRUCTOR'), getAll)
router.get('/:id', authenticate, authorize('ADMIN', 'DEAN_OFFICE', 'INSTRUCTOR'), getOne)
router.post('/', authenticate, authorize('ADMIN'), create)
router.put('/:id', authenticate, authorize('ADMIN'), update)
router.delete('/:id', authenticate, authorize('ADMIN'), remove)

router.get('/:id/rooms', authenticate, authorize('ADMIN', 'DEAN_OFFICE', 'INSTRUCTOR'), getRooms)
router.post('/:id/rooms', authenticate, authorize('ADMIN'), createRoom)
router.put('/:id/rooms/:roomId', authenticate, authorize('ADMIN'), updateRoom)
router.delete('/:id/rooms/:roomId', authenticate, authorize('ADMIN'), removeRoom)

export default router
