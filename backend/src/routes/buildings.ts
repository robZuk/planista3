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

const router = Router()

router.get('/', getAll)
router.post('/', create)
router.get('/:id', getOne)
router.put('/:id', update)
router.delete('/:id', remove)

router.get('/:id/rooms', getRooms)
router.post('/:id/rooms', createRoom)
router.put('/:id/rooms/:roomId', updateRoom)
router.delete('/:id/rooms/:roomId', removeRoom)

export default router
