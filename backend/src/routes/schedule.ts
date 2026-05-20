import { Router } from 'express'
import {
  getAll as getTemplates,
  getOne as getTemplate,
  create as createTemplate,
  update as updateTemplate,
  remove as removeTemplate,
  removeMany as removeManyTemplates,
  getSummary,
} from '../controllers/scheduleTemplate.controller'
import {
  getAll as getEntries,
  getOne as getEntry,
  create as createEntry,
  update as updateEntry,
  remove as removeEntry,
  removeMany as removeManyEntries,
  move as moveEntry,
} from '../controllers/scheduleEntry.controller'
import {
  getAll as getCalendars,
  getOne as getCalendar,
  create as createCalendar,
  update as updateCalendar,
  remove as removeCalendar,
} from '../controllers/semesterCalendar.controller'
import { getAll as getHolidays, create as createHoliday, update as updateHoliday, remove as removeHoliday } from '../controllers/publicHoliday.controller'
import { generateTemplate, generateSemester } from '../controllers/scheduleGenerator.controller'
import { authenticate, authorize } from '../middleware/authenticate'

const router = Router()

// ─── Wzorce tygodniowe ────────────────────────────────────────
router.get('/templates', authenticate, getTemplates)
router.get('/summary/:curriculumVersionId', authenticate, getSummary)
router.get('/templates/:id', authenticate, getTemplate)
router.post('/templates', authenticate, authorize('ADMIN', 'INSTRUCTOR'), createTemplate)
router.put('/templates/:id', authenticate, authorize('ADMIN', 'INSTRUCTOR'), updateTemplate)
router.delete('/templates', authenticate, authorize('ADMIN'), removeManyTemplates)
router.delete('/templates/:id', authenticate, authorize('ADMIN'), removeTemplate)

// ─── Generator ────────────────────────────────────────────────
router.post('/generate-template', authenticate, authorize('ADMIN'), generateTemplate)
router.post('/generate-semester', authenticate, authorize('ADMIN'), generateSemester)

// ─── Konkretne terminy ────────────────────────────────────────
router.get('/entries', authenticate, getEntries)
router.get('/entries/:id', authenticate, getEntry)
router.post('/entries', authenticate, authorize('ADMIN', 'INSTRUCTOR'), createEntry)
router.put('/entries/:id', authenticate, authorize('ADMIN', 'INSTRUCTOR'), updateEntry)
router.delete('/entries', authenticate, authorize('ADMIN'), removeManyEntries)
router.delete('/entries/:id', authenticate, authorize('ADMIN'), removeEntry)
router.post('/entries/:id/move', authenticate, authorize('ADMIN', 'INSTRUCTOR'), moveEntry)

// ─── Kalendarze semestrów ─────────────────────────────────────
router.get('/calendars', authenticate, getCalendars)
router.get('/calendars/:id', authenticate, getCalendar)
router.post('/calendars', authenticate, authorize('ADMIN'), createCalendar)
router.put('/calendars/:id', authenticate, authorize('ADMIN'), updateCalendar)
router.delete('/calendars/:id', authenticate, authorize('ADMIN'), removeCalendar)

// ─── Dni wolne ────────────────────────────────────────────────
router.get('/holidays', authenticate, getHolidays)
router.post('/holidays', authenticate, authorize('ADMIN'), createHoliday)
router.put('/holidays/:id', authenticate, authorize('ADMIN'), updateHoliday)
router.delete('/holidays/:id', authenticate, authorize('ADMIN'), removeHoliday)

export default router
