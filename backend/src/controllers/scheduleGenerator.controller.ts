import { Request, Response } from 'express'
import { ClassType, DayOfWeek, StudyMode } from '@prisma/client'
import prisma from '../lib/prisma'

const dayOfWeekMap: Record<number, DayOfWeek> = {
  1: 'MONDAY', 2: 'TUESDAY', 3: 'WEDNESDAY', 4: 'THURSDAY',
  5: 'FRIDAY', 6: 'SATURDAY', 0: 'SUNDAY',
}

function dateToStr(date: Date): string {
  return date.toISOString().split('T')[0]!
}

function isHolidayDate(date: Date, holidaySet: Set<string>): boolean {
  return holidaySet.has(dateToStr(date))
}

function isInStudyModeWindow(date: Date, studyMode: StudyMode): boolean {
  const day = date.getDay()
  if (studyMode === 'FULL_TIME') return day >= 1 && day <= 5
  return day === 0 || day === 5 || day === 6  // Pt, Sb, Nd
}

function getDatesForDayOfWeek(
  startDate: Date,
  endDate: Date,
  dayOfWeek: DayOfWeek,
  weekType: 'EVERY' | 'EVEN' | 'ODD',
): Date[] {
  const targetDay = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 0 }[dayOfWeek]
  const dates: Date[] = []

  const current = new Date(startDate)
  while (current.getDay() !== targetDay) {
    current.setDate(current.getDate() + 1)
  }

  let weekNumber = 1
  while (current <= endDate) {
    if (
      weekType === 'EVERY' ||
      (weekType === 'EVEN' && weekNumber % 2 === 0) ||
      (weekType === 'ODD' && weekNumber % 2 === 1)
    ) {
      dates.push(new Date(current))
    }
    current.setDate(current.getDate() + 7)
    weekNumber++
  }
  return dates
}

// Automatyczna propozycja wzorca (nie zapisuje do bazy)
export const generateTemplate = async (req: Request, res: Response) => {
  try {
    const { facultyId, fieldOfStudyId, specializationId, semester, academicYear, studyMode } = req.body as {
      facultyId?: string
      fieldOfStudyId?: string
      specializationId?: string
      semester?: number        // opcjonalny — jeśli brak, generuj dla wszystkich semestrów
      academicYear: string
      studyMode?: StudyMode    // opcjonalny — jeśli brak, generuj dla wszystkich trybów
    }

    if (!academicYear) {
      return res.status(400).json({ error: 'Brakujące wymagane pole: academicYear' })
    }
    if (!facultyId && !fieldOfStudyId && !specializationId) {
      return res.status(400).json({ error: 'Podaj co najmniej wydział, kierunek lub specjalność' })
    }

    // Wyznacz listę specjalności do wygenerowania
    type SpecTarget = { id: string; name: string; fieldOfStudyId: string }
    let targetSpecs: SpecTarget[]

    if (specializationId) {
      const spec = await prisma.specialization.findUnique({
        where: { id: specializationId },
        select: { id: true, name: true, fieldOfStudyId: true },
      })
      if (!spec) return res.status(404).json({ error: 'Specjalność nie znaleziona' })
      targetSpecs = [spec]
    } else if (fieldOfStudyId) {
      targetSpecs = await prisma.specialization.findMany({
        where: { fieldOfStudyId },
        select: { id: true, name: true, fieldOfStudyId: true },
      })
    } else {
      targetSpecs = await prisma.specialization.findMany({
        where: { fieldOfStudy: { facultyId } },
        select: { id: true, name: true, fieldOfStudyId: true },
      })
    }

    if (targetSpecs.length === 0) {
      return res.status(404).json({ error: 'Brak specjalności dla podanych parametrów' })
    }

    type TimeWindow = { days: number[]; start: number; end: number }

    const getTimeWindows = (mode: StudyMode): TimeWindow[] =>
      mode === 'FULL_TIME'
        ? [{ days: [1, 2, 3, 4, 5], start: 7 * 60, end: 20 * 60 }]
        : [
            { days: [5], start: 15 * 60, end: 20 * 60 },
            { days: [6, 0], start: 7 * 60, end: 20 * 60 },
          ]

    const roomTypeMap: Record<ClassType, string[]> = {
      LECTURE: ['LECTURE'],
      EXERCISE: ['EXERCISE', 'LECTURE'],
      LAB: ['LAB', 'COMPUTER_LAB'],
      PROJECT: ['EXERCISE', 'COMPUTER_LAB', 'SEMINAR'],
      SEMINAR: ['SEMINAR', 'EXERCISE'],
    }

    const minsFromStr = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return (h ?? 0) * 60 + (m ?? 0)
    }
    const toTime = (mins: number) =>
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
    const dayNumberMap: Record<DayOfWeek, number> = {
      MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 0,
    }

    const rooms = await prisma.room.findMany({ include: { building: { select: { name: true } } } })
    const instructors = await prisma.instructor.findMany({ select: { id: true, firstName: true, lastName: true } })

    // Wspólne śledzenie sal i prowadzących (sala/prowadzący nie może być w dwóch miejscach naraz)
    const usedRoomSlots = new Set<string>()
    const usedInstructorSlots = new Set<string>()

    const markRoom = (roomId: string, day: number, start: number, end: number) => {
      for (let t = start; t < end; t += 30) usedRoomSlots.add(`${roomId}-${day}-${t}`)
    }
    const isRoomFree = (roomId: string, day: number, start: number, end: number) => {
      for (let t = start; t < end; t += 30) if (usedRoomSlots.has(`${roomId}-${day}-${t}`)) return false
      return true
    }
    const markInstructor = (instructorId: string, day: number, start: number, end: number) => {
      for (let t = start; t < end; t += 30) usedInstructorSlots.add(`${instructorId}-${day}-${t}`)
    }
    const isInstructorFree = (instructorId: string, day: number, start: number, end: number) => {
      for (let t = start; t < end; t += 30) if (usedInstructorSlots.has(`${instructorId}-${day}-${t}`)) return false
      return true
    }

    // Pre-populate z już zapisanych szablonów
    const existingTemplates = await prisma.scheduleTemplate.findMany({
      where: { academicYear },
      select: {
        roomId: true, instructorId: true, dayOfWeek: true, startTime: true, endTime: true,
        curriculumEntryId: true, classType: true, academicHours: true,
      },
    })
    // Zbiór już zaplanowanych kombinacji (curriculumEntryId|classType) — pomijamy je w generatorze
    const plannedHoursMap = new Map<string, number>()
    for (const tmpl of existingTemplates) {
      const key = `${tmpl.curriculumEntryId}|${tmpl.classType}`
      plannedHoursMap.set(key, (plannedHoursMap.get(key) ?? 0) + tmpl.academicHours)
      const day = dayNumberMap[tmpl.dayOfWeek]
      const start = minsFromStr(tmpl.startTime)
      const end = minsFromStr(tmpl.endTime) + 15
      markRoom(tmpl.roomId, day, start, end)
      markInstructor(tmpl.instructorId, day, start, end)
    }

    const teachingWeeks = 15
    const allProposals: object[] = []

    // Generuj osobno dla każdej specjalności
    for (const spec of targetSpecs) {
      // Pobierz wszystkie aktywne wersje planów (filtruj tryb tylko jeśli podany)
      const curriculumVersions = await prisma.curriculumVersion.findMany({
        where: {
          specialization: { id: spec.id },
          ...(studyMode ? { studyMode } : {}),
          isActive: true,
        },
        include: {
          entries: {
            where: semester ? { semester } : {},
            include: {
              subject: { select: { name: true } },
              instructor: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      })

      for (const cv of curriculumVersions) {
        const effectiveStudyMode = cv.studyMode
        const timeWindows = getTimeWindows(effectiveStudyMode)

        // Pogrupuj wpisy po semestrze
        const semesterMap = new Map<number, typeof cv.entries>()
        for (const entry of cv.entries) {
          if (!semesterMap.has(entry.semester)) semesterMap.set(entry.semester, [])
          semesterMap.get(entry.semester)!.push(entry)
        }

        for (const [effectiveSemester, entries] of semesterMap) {
          // Osobne śledzenie slotów dla każdej kombinacji (spec, tryb, semestr)
          const usedSlots = new Set<string>()
          const markSlot = (day: number, start: number, end: number) => {
            for (let t = start; t < end; t += 30) usedSlots.add(`${day}-${t}`)
          }
          const isSlotFree = (day: number, start: number, end: number) => {
            for (let t = start; t < end; t += 30) if (usedSlots.has(`${day}-${t}`)) return false
            return true
          }

          const groups = await prisma.studentGroup.findMany({
            where: { specializationId: spec.id, semester: effectiveSemester, academicYear },
          })
          if (groups.length === 0) continue

          const lectureGroup = groups.find(g => g.type === 'LECTURE')
          const defaultSize = lectureGroup?.size ?? 30
          const groupByType: Partial<Record<ClassType, typeof groups[number]>> = {
            [ClassType.LECTURE]:  lectureGroup,
            [ClassType.EXERCISE]: groups.find(g => g.type === 'EXERCISE') ?? lectureGroup,
            [ClassType.LAB]:      groups.find(g => g.type === 'LAB') ?? lectureGroup,
            [ClassType.PROJECT]:  groups.find(g => g.type === 'PROJECT') ?? lectureGroup,
            [ClassType.SEMINAR]:  groups.find(g => g.type === 'SEMINAR') ?? lectureGroup,
          }

          for (const entry of entries) {
            const classTypes: Array<{ type: ClassType; hours: number }> = [
              { type: ClassType.LECTURE,  hours: entry.hoursLecture },
              { type: ClassType.EXERCISE, hours: entry.hoursExercise },
              { type: ClassType.LAB,      hours: entry.hoursLab },
              { type: ClassType.PROJECT,  hours: entry.hoursProject },
              { type: ClassType.SEMINAR,  hours: entry.hoursSeminar },
            ].filter(ct => ct.hours > 0)

            for (const { type, hours } of classTypes) {
              const plannedKey = `${entry.id}|${type}`
              const alreadyPlanned = plannedHoursMap.get(plannedKey) ?? 0
              // Flaga: czy ta kombinacja ma już szablon (ale nie blokujemy — użytkownik może chcieć dodać kolejny slot)
              const alreadyScheduled = alreadyPlanned > 0

              const hoursPerWeek = Math.ceil(hours / teachingWeeks)
              const blockHours = Math.min(Math.max(hoursPerWeek, 1), 2)
              const teachingMinutes = blockHours * 45 + (blockHours - 1) * 15
              const slotMinutes = teachingMinutes + 15

              const allowedRoomTypes = roomTypeMap[type]
              const assignedGroup = groupByType[type]
              const effectiveGroupSize = assignedGroup?.size ?? defaultSize

              // Rooms of the correct type, sorted by capacity ascending (prefer tightest fit)
              const roomsOfCorrectType = rooms
                .filter(r => allowedRoomTypes.includes(r.type))
                .sort((a, b) => a.capacity - b.capacity)
              // Ideal: capacity >= group size; fallback: largest available room of correct type
              const idealRooms = roomsOfCorrectType.filter(r => r.capacity >= effectiveGroupSize)
              const candidateRooms = idealRooms.length > 0
                ? idealRooms
                : [...roomsOfCorrectType].sort((a, b) => b.capacity - a.capacity)

              let found = false
              let capacityNote: string | null = null
              outer:
              for (const window of timeWindows) {
                for (const day of window.days) {
                  for (let start = window.start; start + slotMinutes <= window.end; start += 30) {
                    const slotEnd = start + slotMinutes
                    const teachingEnd = start + teachingMinutes
                    if (!isSlotFree(day, start, slotEnd)) continue
                    const freeRoom = candidateRooms.find(r => isRoomFree(r.id, day, start, slotEnd))
                    if (!freeRoom) continue
                    if (freeRoom.capacity < effectiveGroupSize) {
                      capacityNote = `Sala ${freeRoom.number} (poj. ${freeRoom.capacity}) < wielkość grupy (${effectiveGroupSize})`
                    }

                    let instructorId = entry.instructorId ?? null
                    let instructorName: string | null = null
                    if (instructorId) {
                      const instr = instructors.find(i => i.id === instructorId)
                      if (instr && !isInstructorFree(instr.id, day, start, slotEnd)) {
                        // Prowadzący z siatki zajęty — znajdź innego wolnego
                        const alt = instructors.find(i => i.id !== instructorId && isInstructorFree(i.id, day, start, slotEnd))
                        instructorId = alt?.id ?? null
                        instructorName = alt ? `${alt.firstName} ${alt.lastName}` : null
                      } else {
                        instructorName = instr ? `${instr.firstName} ${instr.lastName}` : null
                      }
                    } else {
                      const freeInstructor = instructors.find(i => isInstructorFree(i.id, day, start, slotEnd))
                      if (freeInstructor) {
                        instructorId = freeInstructor.id
                        instructorName = `${freeInstructor.firstName} ${freeInstructor.lastName}`
                      }
                    }

                    allProposals.push({
                      specializationId: spec.id,
                      specializationName: spec.name,
                      curriculumEntryId: entry.id,
                      subjectName: entry.subject.name,
                      classType: type,
                      academicHours: blockHours,
                      dayOfWeek: dayOfWeekMap[day],
                      startTime: toTime(start),
                      endTime: toTime(teachingEnd),
                      roomId: freeRoom.id,
                      roomNumber: freeRoom.number,
                      buildingName: freeRoom.building.name,
                      instructorId,
                      instructorName,
                      studentGroupId: assignedGroup?.id ?? null,
                      studentGroupName: assignedGroup?.name ?? null,
                      semester: effectiveSemester,
                      academicYear,
                      studyMode: effectiveStudyMode,
                      weekType: 'EVERY' as const,
                      ...(capacityNote ? { note: capacityNote } : {}),
                      ...(alreadyScheduled ? { alreadyScheduled: true } : {}),
                    })

                    markSlot(day, start, slotEnd)
                    markRoom(freeRoom.id, day, start, slotEnd)
                    if (instructorId) markInstructor(instructorId, day, start, slotEnd)
                    found = true
                    break outer
                  }
                }
              }

              if (!found) {
                const warning = roomsOfCorrectType.length === 0
                  ? `Brak sal typu ${allowedRoomTypes.join('/')} w bazie`
                  : 'Wszystkie sale i prowadzący zajęci w oknie czasowym'

                allProposals.push({
                  specializationId: spec.id,
                  specializationName: spec.name,
                  curriculumEntryId: entry.id,
                  subjectName: entry.subject.name,
                  classType: type,
                  academicHours: blockHours,
                  semester: effectiveSemester,
                  studyMode: effectiveStudyMode,
                  warning,
                })
              }
            }
          }
        }
      }
    }

    if (allProposals.length === 0) {
      return res.status(404).json({ error: 'Brak grup lub siatek godzin dla podanych parametrów' })
    }

    res.json({ data: allProposals, meta: { total: allProposals.length } })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}

// Generowanie konkretnych terminów z szablonów
export const generateSemester = async (req: Request, res: Response) => {
  try {
    const { templateIds, calendarId } = req.body as {
      templateIds: string[]
      calendarId: string
    }

    if (!templateIds?.length || !calendarId) {
      return res.status(400).json({ error: 'Brakujące wymagane pola: templateIds, calendarId' })
    }

    const calendar = await prisma.semesterCalendar.findUnique({ where: { id: calendarId } })
    if (!calendar) return res.status(404).json({ error: 'Kalendarz nie znaleziony' })

    const holidays = await prisma.publicHoliday.findMany({
      where: { date: { gte: calendar.startDate, lte: calendar.endDate } },
    })
    const holidaySet = new Set(holidays.map(h => dateToStr(h.date)))

    const templates = await prisma.scheduleTemplate.findMany({
      where: { id: { in: templateIds } },
    })

    const created: object[] = []
    const skipped: { templateId: string; date: string; reason: string }[] = []
    const conflicts: { templateId: string; date: string; type: string; details: string }[] = []

    for (const template of templates) {
      const dates = getDatesForDayOfWeek(
        calendar.startDate,
        calendar.endDate,
        template.dayOfWeek,
        template.weekType,
      )

      for (const date of dates) {
        if (isHolidayDate(date, holidaySet)) {
          skipped.push({ templateId: template.id, date: date.toISOString(), reason: 'HOLIDAY' })
          continue
        }

        if (!isInStudyModeWindow(date, calendar.studyMode)) {
          skipped.push({ templateId: template.id, date: date.toISOString(), reason: 'OUT_OF_WINDOW' })
          continue
        }

        const roomConflict = await prisma.scheduleEntry.findFirst({
          where: {
            roomId: template.roomId,
            date,
            AND: [{ startTime: { lt: template.endTime } }, { endTime: { gt: template.startTime } }],
          },
        })
        if (roomConflict) {
          conflicts.push({ templateId: template.id, date: date.toISOString(), type: 'ROOM_CONFLICT', details: `wpis ${roomConflict.id}` })
          continue
        }

        const instructorConflict = await prisma.scheduleEntry.findFirst({
          where: {
            instructorId: template.instructorId,
            date,
            AND: [{ startTime: { lt: template.endTime } }, { endTime: { gt: template.startTime } }],
          },
        })
        if (instructorConflict) {
          conflicts.push({ templateId: template.id, date: date.toISOString(), type: 'INSTRUCTOR_CONFLICT', details: `wpis ${instructorConflict.id}` })
          continue
        }

        if (template.studentGroupId) {
          const groupConflict = await prisma.scheduleEntry.findFirst({
            where: {
              studentGroupId: template.studentGroupId,
              date,
              AND: [{ startTime: { lt: template.endTime } }, { endTime: { gt: template.startTime } }],
            },
          })
          if (groupConflict) {
            conflicts.push({ templateId: template.id, date: date.toISOString(), type: 'GROUP_CONFLICT', details: `wpis ${groupConflict.id}` })
            continue
          }
        }

        const entry = await prisma.scheduleEntry.create({
          data: {
            date,
            startTime: template.startTime,
            endTime: template.endTime,
            classType: template.classType,
            academicHours: template.academicHours,
            templateId: template.id,
            roomId: template.roomId,
            instructorId: template.instructorId,
            curriculumEntryId: template.curriculumEntryId,
            studentGroupId: template.studentGroupId,
            status: 'SCHEDULED',
          },
        })
        created.push(entry)
      }
    }

    res.json({
      data: { created: created.length, skipped: skipped.length, conflicts: conflicts.length },
      details: { skipped, conflicts },
      message: `Wygenerowano ${created.length} wpisów, pominięto ${skipped.length}, konflikty: ${conflicts.length}`,
    })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}
