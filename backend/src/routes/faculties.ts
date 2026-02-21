import { Router } from 'express'
import { getAll, getOne, create, update, remove } from '../controllers/faculties.controller'

const router = Router()

router.get('/', getAll)
router.post('/', create)
router.get('/:id', getOne)
router.put('/:id', update)
router.delete('/:id', remove)

export default router
