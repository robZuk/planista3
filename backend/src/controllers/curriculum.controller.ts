import { Request, Response } from 'express'
import { StudyMode, DegreeLevel, AssessmentType } from '@prisma/client'
import prisma from '../lib/prisma'
import { isNotFoundError, isUniqueConstraintError } from '../lib/prismaErrors'

// ─── Curriculum Versions ─────────────────────────────────────

export const getAcademicYears = async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.curriculumVersion.findMany({
      select: { academicYear: true },
      distinct: ['academicYear'],
      orderBy: { academicYear: 'desc' },
    })
    res.json({ data: rows.map(r => r.academicYear) })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const getVersions = async (_req: Request, res: Response) => {
  try {
    const data = await prisma.curriculumVersion.findMany({
      include: {
        specialization: {
          include: { fieldOfStudy: { include: { faculty: true } } },
        },
        _count: { select: { entries: true } },
      },
      orderBy: [{ academicYear: 'desc' }],
    })
    res.json({ data })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const getVersion = async (req: Request, res: Response) => {
  try {
    const version = await prisma.curriculumVersion.findUnique({
      where: { id: req.params.id },
      include: {
        specialization: {
          include: { fieldOfStudy: { include: { faculty: true } } },
        },
      },
    })
    if (!version) return res.status(404).json({ error: 'Wersja planu nie znaleziona' })
    res.json({ data: version })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const createVersion = async (req: Request, res: Response) => {
  try {
    const { academicYear, studyMode, degreeLevel, totalSemesters, specializationId } = req.body as {
      academicYear: string
      studyMode: StudyMode
      degreeLevel: DegreeLevel
      totalSemesters: number
      specializationId: string
    }
    if (!academicYear || !studyMode || !degreeLevel || !totalSemesters || !specializationId) {
      return res.status(400).json({ error: 'Wszystkie pola są wymagane' })
    }
    const data = await prisma.curriculumVersion.create({
      data: { academicYear, studyMode, degreeLevel, totalSemesters, specializationId },
    })
    res.status(201).json({ data, message: 'Wersja planu utworzona' })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Wersja planu dla tej specjalności, roku i trybu już istnieje' })
    }
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const updateVersion = async (req: Request, res: Response) => {
  try {
    const { academicYear, isActive, totalSemesters } = req.body as {
      academicYear?: string
      isActive?: boolean
      totalSemesters?: number
    }
    const data = await prisma.curriculumVersion.update({
      where: { id: req.params.id },
      data: { academicYear, isActive, totalSemesters },
    })
    res.json({ data, message: 'Wersja planu zaktualizowana' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Wersja planu nie znaleziona' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const deleteVersion = async (req: Request, res: Response) => {
  try {
    const version = await prisma.curriculumVersion.findUnique({
      where: { id: req.params.id },
      select: { id: true, entries: { select: { id: true } } },
    })
    if (!version) return res.status(404).json({ error: 'Wersja planu nie znaleziona' })

    const entryIds = version.entries.map((e) => e.id)

    await prisma.$transaction([
      // Usuń konkretne terminy powiązane z wpisami tej wersji
      prisma.scheduleEntry.deleteMany({ where: { curriculumEntryId: { in: entryIds } } }),
      // Usuń wzorce tygodniowe powiązane z wpisami tej wersji
      prisma.scheduleTemplate.deleteMany({ where: { curriculumEntryId: { in: entryIds } } }),
      // Usuń wersję planu (kaskada usuwa CurriculumEntry)
      prisma.curriculumVersion.delete({ where: { id: req.params.id } }),
    ])

    res.json({ message: 'Wersja planu usunięta' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Wersja planu nie znaleziona' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

// ─── Curriculum Entries ──────────────────────────────────────

export const getEntries = async (req: Request, res: Response) => {
  try {
    const { semester } = req.query

    const version = await prisma.curriculumVersion.findUnique({
      where: { id: req.params.id },
      select: { id: true, academicYear: true, studyMode: true, degreeLevel: true, totalSemesters: true },
    })
    if (!version) return res.status(404).json({ error: 'Wersja planu nie znaleziona' })

    const entries = await prisma.curriculumEntry.findMany({
      where: {
        curriculumVersionId: req.params.id,
        ...(semester ? { semester: Number(semester) } : {}),
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        instructor: { select: { id: true, firstName: true, lastName: true, title: true } },
      },
      orderBy: [{ semester: 'asc' }, { orderInSemester: 'asc' }],
    })

    // Grupuj po semestrach
    const semesterMap = new Map<number, typeof entries>()
    for (const entry of entries) {
      const sem = entry.semester
      if (!semesterMap.has(sem)) semesterMap.set(sem, [])
      semesterMap.get(sem)!.push(entry)
    }

    const semesters = Array.from(semesterMap.entries()).map(([sem, semEntries]) => ({
      semester: sem,
      totalEcts: semEntries.reduce((sum, e) => sum + e.ects, 0),
      entries: semEntries.map((e) => ({
        id: e.id,
        orderInSemester: e.orderInSemester,
        subject: e.subject,
        instructor: e.instructor,
        hoursLecture: e.hoursLecture,
        hoursExercise: e.hoursExercise,
        hoursLab: e.hoursLab,
        hoursProject: e.hoursProject,
        hoursSeminar: e.hoursSeminar,
        totalHours: e.hoursLecture + e.hoursExercise + e.hoursLab + e.hoursProject + e.hoursSeminar,
        ects: e.ects,
        assessmentType: e.assessmentType,
      })),
    }))

    res.json({ data: { version, semesters } })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const addEntry = async (req: Request, res: Response) => {
  try {
    const {
      subjectId,
      instructorId,
      semester,
      orderInSemester,
      hoursLecture,
      hoursExercise,
      hoursLab,
      hoursProject,
      hoursSeminar,
      ects,
      assessmentType,
    } = req.body as {
      subjectId: string
      instructorId?: string
      semester: number
      orderInSemester: number
      hoursLecture?: number
      hoursExercise?: number
      hoursLab?: number
      hoursProject?: number
      hoursSeminar?: number
      ects?: number
      assessmentType?: AssessmentType
    }

    if (!subjectId || !semester || orderInSemester === undefined) {
      return res.status(400).json({ error: 'Pola subjectId, semester i orderInSemester są wymagane' })
    }

    const data = await prisma.curriculumEntry.create({
      data: {
        curriculumVersionId: req.params.id,
        subjectId,
        instructorId,
        semester,
        orderInSemester,
        hoursLecture: hoursLecture ?? 0,
        hoursExercise: hoursExercise ?? 0,
        hoursLab: hoursLab ?? 0,
        hoursProject: hoursProject ?? 0,
        hoursSeminar: hoursSeminar ?? 0,
        ects: ects ?? 0,
        assessmentType: assessmentType ?? 'CREDIT',
      },
    })
    res.status(201).json({ data, message: 'Przedmiot dodany do siatki' })
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: 'Ten przedmiot jest już w siatce dla tego semestru' })
    }
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const updateEntry = async (req: Request, res: Response) => {
  try {
    const {
      hoursLecture,
      hoursExercise,
      hoursLab,
      hoursProject,
      hoursSeminar,
      ects,
      assessmentType,
      instructorId,
      orderInSemester,
    } = req.body as {
      hoursLecture?: number
      hoursExercise?: number
      hoursLab?: number
      hoursProject?: number
      hoursSeminar?: number
      ects?: number
      assessmentType?: AssessmentType
      instructorId?: string
      orderInSemester?: number
    }
    const data = await prisma.curriculumEntry.update({
      where: { id: req.params.id },
      data: { hoursLecture, hoursExercise, hoursLab, hoursProject, hoursSeminar, ects, assessmentType, instructorId, orderInSemester },
    })
    res.json({ data, message: 'Wpis zaktualizowany' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Wpis nie znaleziony' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

export const deleteEntry = async (req: Request, res: Response) => {
  try {
    await prisma.curriculumEntry.delete({ where: { id: req.params.id } })
    res.json({ message: 'Wpis usunięty' })
  } catch (error) {
    if (isNotFoundError(error)) return res.status(404).json({ error: 'Wpis nie znaleziony' })
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}

// ─── Walidacja ───────────────────────────────────────────────

export const validateVersion = async (req: Request, res: Response) => {
  try {
    const entries = await prisma.curriculumEntry.findMany({
      where: { curriculumVersionId: req.params.id },
      include: { subject: true },
      orderBy: [{ semester: 'asc' }, { orderInSemester: 'asc' }],
    })

    if (entries.length === 0) {
      return res.status(404).json({ error: 'Wersja planu nie istnieje lub nie ma wpisów' })
    }

    type ValidationError = { semester: number; entryId: string; subjectName: string; issue: string }
    type ValidationWarning = { semester: number; issue: string }

    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    const semesterEcts = new Map<number, number>()

    for (const entry of entries) {
      const totalHours =
        entry.hoursLecture + entry.hoursExercise + entry.hoursLab + entry.hoursProject + entry.hoursSeminar

      if (totalHours === 0) {
        errors.push({
          semester: entry.semester,
          entryId: entry.id,
          subjectName: entry.subject.name,
          issue: 'Suma godzin (W+C+L+P+S) = 0',
        })
      }

      if (entry.ects === 0 && totalHours > 0) {
        errors.push({
          semester: entry.semester,
          entryId: entry.id,
          subjectName: entry.subject.name,
          issue: 'ECTS = 0 przy godzinach > 0',
        })
      }

      semesterEcts.set(entry.semester, (semesterEcts.get(entry.semester) ?? 0) + entry.ects)
    }

    for (const [semester, ects] of semesterEcts.entries()) {
      if (ects === 0) {
        warnings.push({ semester, issue: `Semestr ${semester} ma 0 punktów ECTS` })
      }
    }

    res.json({
      data: {
        isValid: errors.length === 0,
        errors,
        warnings,
      },
    })
  } catch (error) {
    console.error(error); res.status(500).json({ error: 'Błąd serwera' })
  }
}
