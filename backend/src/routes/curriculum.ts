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

const router = Router()

// Versions
router.get('/versions', getVersions)
router.post('/versions', createVersion)
router.get('/versions/:id', getVersion)
router.put('/versions/:id', updateVersion)
router.delete('/versions/:id', deleteVersion)

// Entries (nested under versions)
router.get('/versions/:id/entries', getEntries)
router.post('/versions/:id/entries', addEntry)

// Entries (standalone)
router.put('/entries/:id', updateEntry)
router.delete('/entries/:id', deleteEntry)

// Validation
router.get('/versions/:id/validate', validateVersion)

export default router
