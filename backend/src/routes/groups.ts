import { Router } from 'express'
import { getAll, getOne, generate, confirm, createOne, update, remove } from '../controllers/groups.controller'

const router = Router()

router.get('/', getAll)
router.get('/:id', getOne)
router.post('/generate', generate)
router.post('/confirm', confirm)
router.post('/', createOne)
router.put('/:id', update)
router.delete('/:id', remove)

export default router
