import { Router } from 'express'
import { getAll, getOne, create, update, remove, getSummary } from '../controllers/schedule.controller'

const router = Router()

router.get('/', getAll)
router.post('/', create)
router.get('/summary/:curriculumVersionId', getSummary)
router.get('/:id', getOne)
router.put('/:id', update)
router.delete('/:id', remove)

export default router
