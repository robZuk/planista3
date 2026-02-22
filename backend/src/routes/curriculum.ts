import { Router } from 'express'
import {
  getVersions,
  getVersion,
  createVersion,
  updateVersion,
  deleteVersion,
  getEntries,
  addEntry,
  updateEntry,
  deleteEntry,
  validateVersion,
} from '../controllers/curriculum.controller'
import { authenticate, authorize } from '../middleware/authenticate'

const router = Router()

// Versions — odczyt dla wszystkich zalogowanych
router.get('/versions', authenticate, getVersions)
router.get('/versions/:id', authenticate, getVersion)
router.get('/versions/:id/validate', authenticate, validateVersion)
router.get('/versions/:id/entries', authenticate, getEntries)

// Versions — zapis tylko ADMIN
router.post('/versions', authenticate, authorize('ADMIN'), createVersion)
router.put('/versions/:id', authenticate, authorize('ADMIN'), updateVersion)
router.delete('/versions/:id', authenticate, authorize('ADMIN'), deleteVersion)

// Entries — zapis tylko ADMIN
router.post('/versions/:id/entries', authenticate, authorize('ADMIN'), addEntry)
router.put('/entries/:id', authenticate, authorize('ADMIN'), updateEntry)
router.delete('/entries/:id', authenticate, authorize('ADMIN'), deleteEntry)

export default router
