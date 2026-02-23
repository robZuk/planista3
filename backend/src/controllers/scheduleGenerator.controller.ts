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
    const { fieldOfStudyId, specializationId, semester, academicYear, studyMode } = req.body as {
      fieldOfStudyId: string
      specializationId?: string
      semester: number
      academicYear: string
      studyMode: StudyMode
    }

    if (!fieldOfStudyId || !semester || !academicYear || !studyMode) {
      return res.status(400).json({ error: 'Brakujące wymagane pola' })
    }

    const groups = await prisma.studentGroup.findMany({
      where: {
        fieldOfStudyId,
        ...(specializationId ? { specializationId } : {}),
        semester,
        academicYear,
      },
    })

    if (groups.length === 0) {
      return res.status(404).json({ error: 'Brak grup dla podanych parametrów' })
    }

    const curriculumVersion = await prisma.curriculumVersion.findFirst({
      where: {
        specialization: {
          ...(specializationId ? { id: specializationId } : { fieldOfStudyId }),
        },
        studyMode,
        isActive: true,
      },
      include: {
        entries: {
          where: { semester },
          include: { subject: { select: { name: true } }, instructor: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    })

    if (!curriculumVersion || curriculumVersion.entries.length === 0) {
      return res.status(404).json({ error: 'Brak siatki godzin dla podanych parametrów' })
    }

    // Okna czasowe wg trybu (minuty od północy)
    type TimeWindow = { days: number[]; start: number; end: number }
    const timeWindows: TimeWindow[] = studyMode === 'FULL_TIME'
      ? [{ days: [1, 2, 3, 4, 5], start: 7 * 60, end: 20 * 60 }]
      : [
          { days: [5], start: 15 * 60, end: 20 * 60 },
          { days: [6, 0], start: 7 * 60, end: 20 * 60 },
        ]

    // typ zajęć → dopuszczalne typy sal
    const roomTypeMap: Record<ClassType, string[]> = {
      LECTURE: ['LECTURE'],
      EXERCISE: ['EXERCISE', 'LECTURE'],
      LAB: ['LAB', 'COMPUTER_LAB'],
      PROJECT: ['EXERCISE', 'COMPUTER_LAB', 'SEMINAR'],
      SEMINAR: ['SEMINAR', 'EXERCISE'],
    }

    const rooms = await prisma.room.findMany({
      include: { building: { select: { name: true } } },
    })

    const instructors = await prisma.instructor.findMany({
      select: { id: true, firstName: true, lastName: true },
    })

    const lectureGroup = groups.find(g => g.type === 'LECTURE')
    const groupSize = lectureGroup?.size ?? 30

    // Śledzenie zajętości slotów w drafcie
    const usedSlots = new Set<string>()            // `${day}-${t}` per 30 min
    const usedRoomSlots = new Set<string>()        // `${roomId}-${day}-${t}`
    const usedInstructorSlots = new Set<string>()  // `${instructorId}-${day}-${t}`

    const markSlot = (day: number, start: number, end: number) => {
      for (let t = start; t < end; t += 30) usedSlots.add(`${day}-${t}`)
    }
    const isSlotFree = (day: number, start: number, end: number) => {
      for (let t = start; t < end; t += 30) if (usedSlots.has(`${day}-${t}`)) return false
      return true
    }
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

    const teachingWeeks = 15
    const proposals: object[] = []

    for (const entry of curriculumVersion.entries) {
      const classTypes: Array<{ type: ClassType; hours: number }> = [
        { type: ClassType.LECTURE,  hours: entry.hoursLecture },
        { type: ClassType.EXERCISE, hours: entry.hoursExercise },
        { type: ClassType.LAB,      hours: entry.hoursLab },
        { type: ClassType.PROJECT,  hours: entry.hoursProject },
        { type: ClassType.SEMINAR,  hours: entry.hoursSeminar },
      ].filter(ct => ct.hours > 0)

      for (const { type, hours } of classTypes) {
        const hoursPerWeek = Math.ceil(hours / teachingWeeks)
        const blockHours = Math.min(Math.max(hoursPerWeek, 1), 2)
        const blockMinutes = blockHours * 45

        const allowedRoomTypes = roomTypeMap[type]
        const suitableRooms = rooms.filter(r =>
          allowedRoomTypes.includes(r.type) && r.capacity >= groupSize
        )

        let found = false
        outer:
        for (const window of timeWindows) {
          for (const day of window.days) {
            for (let start = window.start; start + blockMinutes <= window.end; start += 30) {
              const end = start + blockMinutes
              if (!isSlotFree(day, start, end)) continue
              const freeRoom = suitableRooms.find(r => isRoomFree(r.id, day, start, end))
              if (!freeRoom) continue

              const toTime = (mins: number) =>
                `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

              // Prowadzący z siatki lub pierwszy wolny
              let instructorId = entry.instructorId ?? null
              let instructorName: string | null = null
              if (instructorId) {
                const instr = instructors.find(i => i.id === instructorId)
                instructorName = instr ? `${instr.firstName} ${instr.lastName}` : null
              } else {
                const freeInstructor = instructors.find(i => isInstructorFree(i.id, day, start, end))
                if (freeInstructor) {
                  instructorId = freeInstructor.id
                  instructorName = `${freeInstructor.firstName} ${freeInstructor.lastName}`
                }
              }

              proposals.push({
                curriculumEntryId: entry.id,
                subjectName: entry.subject.name,
                classType: type,
                academicHours: blockHours,
                dayOfWeek: dayOfWeekMap[day],
                startTime: toTime(start),
                endTime: toTime(end),
                roomId: freeRoom.id,
                roomNumber: freeRoom.number,
                buildingName: freeRoom.building.name,
                instructorId,
                instructorName,
                semester,
                academicYear,
                studyMode,
                weekType: 'EVERY' as const,
              })

              markSlot(day, start, end)
              markRoom(freeRoom.id, day, start, end)
              if (instructorId) markInstructor(instructorId, day, start, end)
              found = true
              break outer
            }
          }
        }

        if (!found) {
          const roomsOfType = rooms.filter(r => roomTypeMap[type].includes(r.type))
          const warning = suitableRooms.length === 0
            ? roomsOfType.length === 0
              ? `Brak sal typu ${allowedRoomTypes.join('/')} w bazie`
              : `Brak sal ${allowedRoomTypes.join('/')} o pojemności ≥ ${groupSize} (dostępne: ${roomsOfType.map(r => r.number).join(', ')})`
            : 'Wszystkie sale i prowadzący zajęci w oknie czasowym'

          proposals.push({
            curriculumEntryId: entry.id,
            subjectName: entry.subject.name,
            classType: type,
            academicHours: blockHours,
            warning,
          })
        }
      }
    }

    res.json({ data: proposals, meta: { total: proposals.length } })
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
