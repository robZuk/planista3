import { Router } from 'express'
import { register, login, refresh, logout, me } from '../controllers/auth.controller'
import { authenticate, authorize } from '../middleware/authenticate'

const router = Router()

router.post('/login', login)
router.post('/refresh', refresh)
router.post('/register', authenticate, authorize('ADMIN'), register)
router.post('/logout', authenticate, logout)
router.get('/me', authenticate, me)

export default router
