import { Request, Response } from 'express'
import { ClassType, DayOfWeek, StudyMode, WeekType } from '@prisma/client'
import prisma from '../lib/prisma'
import { getGroupFamilyIds } from '../lib/groupFamily'

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

function isInStudyModeWindow(date: Date, studyMode: StudyMode, startTime?: string): boolean {
  const day = date.getDay()
  if (studyMode === 'FULL_TIME') return day >= 1 && day <= 5
  // PART_TIME: Sb (6) i Nd (0) od 07:00, Pt (5) tylko od 15:00
  if (day === 6 || day === 0) return true
  if (day === 5) {
    if (!startTime) return true
    const [h, m] = startTime.split(':').map(Number)
    return (h ?? 0) * 60 + (m ?? 0) >= 15 * 60
  }
  return false
}

function getDatesForDayOfWeek(
  startDate: Date,
  endDate: Date,
  dayOfWeek: DayOfWeek,
  weekType: 'EVERY' | 'EVEN' | 'ODD',
): Date[] {
  const targetDay = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 0 }[dayOfWeek]
  const dates: Date[] = []

  // Użyj UTC noon — odporne na zmiany czasu (DST ±1h nie przekracza granicy doby)
  const current = new Date(startDate)
  current.setUTCHours(12, 0, 0, 0)
  while (current.getUTCDay() !== targetDay) {
    current.setUTCDate(current.getUTCDate() + 1)
  }

  const endNoon = new Date(endDate)
  endNoon.setUTCHours(23, 59, 59, 999)

  let weekNumber = 1
  while (current <= endNoon) {
    if (
      weekType === 'EVERY' ||
      (weekType === 'EVEN' && weekNumber % 2 === 0) ||
      (weekType === 'ODD' && weekNumber % 2 === 1)
    ) {
      dates.push(new Date(current))
    }
    current.setUTCDate(current.getUTCDate() + 7)
    weekNumber++
  }
  return dates
}

// ─── WeekType-aware slot tracking ────────────────────────────────────────────
//
// EVEN and ODD subjects occupy different calendar weeks and do NOT conflict.
// EVERY subjects occupy all weeks and conflict with EVEN, ODD, and other EVERY.
//
// Key layout per time-slot t:
//   "${prefix}-${t}-EVERY"  → blocked for EVERY subjects (anyone here blocks new EVERY)
//   "${prefix}-${t}-EVEN"   → blocked for EVEN subjects
//   "${prefix}-${t}-ODD"    → blocked for ODD subjects

function markInSet(set: Set<string>, prefix: string, start: number, end: number, wt: WeekType): void {
  for (let t = start; t < end; t += 30) {
    const p = `${prefix}-${t}`
    // Adding to EVERY slot always: anyone placed here blocks a new EVERY from using it
    set.add(`${p}-EVERY`)
    if (wt === 'EVERY') {
      // EVERY occupies all weeks → blocks EVEN and ODD too
      set.add(`${p}-EVEN`)
      set.add(`${p}-ODD`)
    } else {
      // EVEN/ODD only occupies its own alternating weeks
      set.add(`${p}-${wt}`)
    }
  }
}

function isFreeInSet(set: Set<string>, prefix: string, start: number, end: number, wt: WeekType): boolean {
  for (let t = start; t < end; t += 30) {
    const p = `${prefix}-${t}`
    // Each key covers: EVERY=any occupant, EVEN=EVEN or EVERY occupant, ODD=ODD or EVERY occupant
    // markInSet ensures:
    //   EVERY placed → sets EVERY+EVEN+ODD
    //   EVEN placed  → sets EVERY+EVEN   (ODD key stays clear → ODD can share)
    //   ODD placed   → sets EVERY+ODD    (EVEN key stays clear → EVEN can share)
    if (wt === 'EVERY' && set.has(`${p}-EVERY`)) return false
    if (wt === 'EVEN'  && set.has(`${p}-EVEN`))  return false
    if (wt === 'ODD'   && set.has(`${p}-ODD`))   return false
  }
  return true
}

// Automatyczna propozycja wzorca (nie zapisuje do bazy)
export const generateTemplate = async (req: Request, res: Response) => {
  try {
    const { facultyId, fieldOfStudyId, specializationId, semester, semesterType, academicYear, studyMode } = req.body as {
      facultyId?: string
      fieldOfStudyId?: string
      specializationId?: string
      semester?: number
      semesterType?: 'WINTER' | 'SUMMER'
      academicYear: string
      studyMode?: StudyMode
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

    type DayWindow = { day: number; start: number; end: number }

    const getDayWindows = (mode: StudyMode): DayWindow[] =>
      mode === 'FULL_TIME'
        ? [1, 2, 3, 4, 5].map(d => ({ day: d, start: 7 * 60, end: 20 * 60 }))
        : [
            { day: 5, start: 15 * 60, end: 20 * 60 },  // Piątek 15:00–20:00
            { day: 6, start: 7 * 60,  end: 20 * 60 },  // Sobota 07:00–20:00
            { day: 0, start: 7 * 60,  end: 20 * 60 },  // Niedziela 07:00–20:00
          ]

    // Dla wykładów: preferujemy sale wykładowe, ale jeśli brak wolnych — fallback do sal ćwiczeniowych
    // (obsługiwane przez sortowanie kandydatów: LECTURE > EXERCISE, z filtrem pojemności)
    const roomTypeMap: Record<ClassType, string[]> = {
      LECTURE:  ['LECTURE', 'EXERCISE'],
      EXERCISE: ['EXERCISE'],
      LAB:      ['LAB', 'COMPUTER_LAB'],
      PROJECT:  ['EXERCISE', 'COMPUTER_LAB', 'SEMINAR'],
      SEMINAR:  ['SEMINAR', 'EXERCISE'],
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

    // Wspólne śledzenie sal i prowadzących (weekType-aware)
    const usedRoomSlots = new Set<string>()
    const usedInstructorSlots = new Set<string>()

    const markRoom = (roomId: string, day: number, start: number, end: number, wt: WeekType) =>
      markInSet(usedRoomSlots, `${roomId}-${day}`, start, end, wt)
    const isRoomFree = (roomId: string, day: number, start: number, end: number, wt: WeekType) =>
      isFreeInSet(usedRoomSlots, `${roomId}-${day}`, start, end, wt)
    const markInstructor = (instructorId: string, day: number, start: number, end: number, wt: WeekType) =>
      markInSet(usedInstructorSlots, `${instructorId}-${day}`, start, end, wt)
    const isInstructorFree = (instructorId: string, day: number, start: number, end: number, wt: WeekType) =>
      isFreeInSet(usedInstructorSlots, `${instructorId}-${day}`, start, end, wt)

    // Pre-populate z już zapisanych szablonów (ALL specs — ensures no conflicts at save time)
    const existingTemplates = await prisma.scheduleTemplate.findMany({
      where: { academicYear },
      select: {
        roomId: true, instructorId: true, dayOfWeek: true, startTime: true, endTime: true,
        weekType: true, curriculumEntryId: true, classType: true, academicHours: true,
      },
    })
    // Zbiór już zaplanowanych kombinacji (curriculumEntryId|classType) — informacja dla UI
    const plannedHoursMap = new Map<string, number>()
    for (const tmpl of existingTemplates) {
      const key = `${tmpl.curriculumEntryId}|${tmpl.classType}`
      plannedHoursMap.set(key, (plannedHoursMap.get(key) ?? 0) + tmpl.academicHours)

      const day = dayNumberMap[tmpl.dayOfWeek]
      const start = minsFromStr(tmpl.startTime)
      const end = minsFromStr(tmpl.endTime)
      const wt = (tmpl.weekType ?? 'EVERY') as WeekType
      markRoom(tmpl.roomId, day, start, end, wt)
      markInstructor(tmpl.instructorId, day, start, end, wt)
    }

    const teachingWeeks = 15

    // Bazowe preferowane godziny startu wg typu zajęć
    const basePreferredByType: Record<ClassType, number> = {
      [ClassType.LECTURE]:  8 * 60,   // 08:00
      [ClassType.EXERCISE]: 10 * 60,  // 10:00
      [ClassType.LAB]:      12 * 60,  // 12:00
      [ClassType.PROJECT]:  12 * 60,  // 12:00
      [ClassType.SEMINAR]:  14 * 60,  // 14:00
    }

    // Licznik grup (spec+semestr) — każda grupa dostaje inne przesunięcie czasowe
    let groupCounter = 0

    const allProposals: object[] = []

    // Generuj osobno dla każdej specjalności
    for (const spec of targetSpecs) {
      const curriculumVersions = await prisma.curriculumVersion.findMany({
        where: {
          specialization: { id: spec.id },
          ...(studyMode ? { studyMode } : {}),
          isActive: true,
        },
        include: {
          entries: {
            where: semester
              ? { semester }
              : semesterType
                ? { semester: { in: semesterType === 'WINTER' ? [1, 3, 5, 7] : [2, 4, 6] } }
                : {},
            include: {
              subject: { select: { name: true } },
              instructor: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      })

      for (const cv of curriculumVersions) {
        const effectiveStudyMode = cv.studyMode
        const dayWindows = getDayWindows(effectiveStudyMode)

        // Pogrupuj wpisy po semestrze
        const semesterMap = new Map<number, typeof cv.entries>()
        for (const entry of cv.entries) {
          if (!semesterMap.has(entry.semester)) semesterMap.set(entry.semester, [])
          semesterMap.get(entry.semester)!.push(entry)
        }

        for (const [effectiveSemester, entries] of semesterMap) {
          // Licznik zajęć na dzień — do równomiernego rozkładu
          const dayLoad = new Map<number, number>()

          // Przesunięcie czasowe dla tej grupy: krok 150 min, modulo 780 min (13h okno)
          const groupTimeOffset = (groupCounter * 150) % 780
          groupCounter++

          const allSpecGroups = await prisma.studentGroup.findMany({
            where: { specializationId: spec.id, semester: effectiveSemester, academicYear },
          })
          const groups = allSpecGroups.filter(g =>
            effectiveStudyMode === 'PART_TIME' ? g.name.includes('-SN-') : !g.name.includes('-SN-')
          )
          if (groups.length === 0) continue

          // Hierarchia grup: rodzic → dzieci, dziecko → rodzic.
          // Wykład EDST-1-W i ćwiczenia EDST-1-C-A nie mogą być w tym samym czasie
          // (studenci C-A chodzą też na W), ale EDST-1-C-A i EDST-1-C-B (rodzeństwo) mogą.
          const grpParent = new Map<string, string>()
          const grpChildren = new Map<string, string[]>()
          for (const g of groups) {
            if (!grpChildren.has(g.id)) grpChildren.set(g.id, [])
            if (g.parentGroupId) {
              grpParent.set(g.id, g.parentGroupId)
              if (!grpChildren.has(g.parentGroupId)) grpChildren.set(g.parentGroupId, [])
              grpChildren.get(g.parentGroupId)!.push(g.id)
            }
          }

          // Zwraca groupId + wszyscy przodkowie + wszyscy potomkowie (bez rodzeństwa).
          const getGroupFamily = (groupId: string): string[] => {
            const result: string[] = [groupId]
            let curr = groupId
            while (grpParent.has(curr)) { const p = grpParent.get(curr)!; result.push(p); curr = p }
            const queue = [groupId]
            while (queue.length > 0) {
              const id = queue.shift()!
              for (const childId of (grpChildren.get(id) ?? [])) { result.push(childId); queue.push(childId) }
            }
            return result
          }

          // Śledzenie slotów per grupa — weekType-aware.
          // markGroupSlot propaguje do całej rodziny (przodkowie + potomkowie),
          // isGroupSlotFree sprawdza wyłącznie własny zestaw.
          const groupSlotSets = new Map<string, Set<string>>()
          const getGroupSet = (groupId: string) => {
            if (!groupSlotSets.has(groupId)) groupSlotSets.set(groupId, new Set())
            return groupSlotSets.get(groupId)!
          }
          const markGroupSlot = (groupId: string, day: number, start: number, end: number, wt: WeekType) => {
            for (const id of getGroupFamily(groupId)) markInSet(getGroupSet(id), `${day}`, start, end, wt)
          }
          const isGroupSlotFree = (groupId: string, day: number, start: number, end: number, wt: WeekType) =>
            isFreeInSet(getGroupSet(groupId), `${day}`, start, end, wt)

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

            let evenOddCounter = 0

            for (const { type, hours } of classTypes) {
              const plannedKey = `${entry.id}|${type}`
              const alreadyPlanned = plannedHoursMap.get(plannedKey) ?? 0
              const alreadyScheduled = alreadyPlanned > 0

              const hoursPerWeekRaw = hours / teachingWeeks
              // Subjects ≤1h/week → EVEN/ODD with 2h block (more practical than 1×45min weekly)
              let blockHours: number
              let weekType: WeekType
              if (hoursPerWeekRaw < 1.0 && hours > 1) {
                blockHours = 2
                weekType = evenOddCounter % 2 === 0 ? 'EVEN' : 'ODD'
                evenOddCounter++
              } else {
                blockHours = Math.min(Math.max(Math.ceil(hoursPerWeekRaw), 1), 2)
                weekType = 'EVERY'
              }
              const teachingMinutes = blockHours * 45 + (blockHours - 1) * 15
              const slotMinutes = teachingMinutes + 15

              const allowedRoomTypes = roomTypeMap[type]
              const assignedGroup = groupByType[type]
              const effectiveGroupSize = assignedGroup?.size ?? defaultSize

              // Rooms of the correct type, sorted by capacity ascending (prefer tightest fit).
              // For LECTURE: LECTURE rooms come before EXERCISE rooms of equal capacity
              // so that exercise rooms are a true fallback.
              const roomsOfCorrectType = rooms
                .filter(r => allowedRoomTypes.includes(r.type))
                .sort((a, b) => {
                  if (type === ClassType.LECTURE) {
                    const aIsLecture = a.type === 'LECTURE' ? 0 : 1
                    const bIsLecture = b.type === 'LECTURE' ? 0 : 1
                    if (aIsLecture !== bIsLecture) return aIsLecture - bIsLecture
                  }
                  return a.capacity - b.capacity
                })
              const idealRooms = roomsOfCorrectType.filter(r => r.capacity >= effectiveGroupSize)
              const candidateRooms = idealRooms.length > 0
                ? idealRooms
                : [...roomsOfCorrectType].sort((a, b) => b.capacity - a.capacity)

              // Zbierz wszystkie kandydackie sloty (wolna sala + wolna grupa)
              type SlotCandidate = { day: number; start: number; freeRoom: typeof rooms[number] }
              const slotCandidates: SlotCandidate[] = []

              const sortedDayWindows = [...dayWindows].sort(
                (a, b) => (dayLoad.get(a.day) ?? 0) - (dayLoad.get(b.day) ?? 0)
              )
              for (const { day, start: winStart, end: winEnd } of sortedDayWindows) {
                const windowLen = winEnd - winStart
                const base = ((basePreferredByType[type] ?? winStart) - winStart + windowLen) % windowLen
                const preferredRaw = winStart + (base + groupTimeOffset) % windowLen
                const preferred = Math.max(winStart, Math.floor(preferredRaw / 60) * 60)

                const slotsToTry: number[] = []
                for (let s = preferred; s + slotMinutes <= winEnd; s += 60) slotsToTry.push(s)
                for (let s = winStart; s < preferred; s += 60) {
                  if (s + slotMinutes <= winEnd) slotsToTry.push(s)
                }

                for (const start of slotsToTry) {
                  const slotEnd = start + slotMinutes
                  if (assignedGroup && !isGroupSlotFree(assignedGroup.id, day, start, slotEnd, weekType)) continue
                  const freeRoom = candidateRooms.find(r => isRoomFree(r.id, day, start, slotEnd, weekType))
                  if (!freeRoom) continue
                  slotCandidates.push({ day, start, freeRoom })
                }
              }

              // Faza 1: szukaj slotu gdzie można przypisać prowadzącego
              type Chosen = { day: number; start: number; freeRoom: typeof rooms[number]; instrId: string | null; instrName: string | null }
              let chosen: Chosen | null = null

              for (const { day, start, freeRoom } of slotCandidates) {
                const slotEnd = start + slotMinutes
                let instrId: string | null = entry.instructorId ?? null
                let instrName: string | null = null

                if (instrId) {
                  if (isInstructorFree(instrId, day, start, slotEnd, weekType)) {
                    const instr = instructors.find(i => i.id === instrId)
                    instrName = instr ? `${instr.firstName} ${instr.lastName}` : null
                  } else {
                    // Przypisany zajęty — szukaj wolnego zastępcy
                    const alt = instructors.find(i => i.id !== instrId && isInstructorFree(i.id, day, start, slotEnd, weekType))
                    instrId = alt?.id ?? null
                    instrName = alt ? `${alt.firstName} ${alt.lastName}` : null
                  }
                } else {
                  const free = instructors.find(i => isInstructorFree(i.id, day, start, slotEnd, weekType))
                  instrId = free?.id ?? null
                  instrName = free ? `${free.firstName} ${free.lastName}` : null
                }

                if (instrId !== null) {
                  chosen = { day, start, freeRoom, instrId, instrName }
                  break
                }
              }

              // Faza 2: fallback — weź pierwszy dostępny slot (sala + grupa), bez prowadzącego
              if (!chosen && slotCandidates.length > 0) {
                const { day, start, freeRoom } = slotCandidates[0]!
                chosen = { day, start, freeRoom, instrId: null, instrName: null }
              }

              if (chosen) {
                const { day, start, freeRoom, instrId, instrName } = chosen
                const slotEnd = start + slotMinutes
                let capacityNote: string | null = null
                if (freeRoom.capacity < effectiveGroupSize) {
                  capacityNote = `Sala ${freeRoom.number} (poj. ${freeRoom.capacity}) < wielkość grupy (${effectiveGroupSize})`
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
                  endTime: toTime(start + slotMinutes),
                  roomId: freeRoom.id,
                  roomNumber: freeRoom.number,
                  buildingName: freeRoom.building.name,
                  instructorId: instrId,
                  instructorName: instrName,
                  studentGroupId: assignedGroup?.id ?? null,
                  studentGroupName: assignedGroup?.name ?? null,
                  semester: effectiveSemester,
                  academicYear,
                  studyMode: effectiveStudyMode,
                  weekType,
                  ...(capacityNote ? { note: capacityNote } : {}),
                  ...(alreadyScheduled ? { alreadyScheduled: true } : {}),
                })

                if (assignedGroup) markGroupSlot(assignedGroup.id, day, start, slotEnd, weekType)
                markRoom(freeRoom.id, day, start, slotEnd, weekType)
                if (instrId) markInstructor(instrId, day, start, slotEnd, weekType)
                dayLoad.set(day, (dayLoad.get(day) ?? 0) + 1)
              } else {
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
// Domyślne daty semestru wg roku akademickiego (np. "2024/2025") i semestru
function deriveCalendarDates(academicYear: string, semesterType: 'WINTER' | 'SUMMER', studyMode: StudyMode) {
  const firstYear = parseInt(academicYear.split('/')[0] ?? '2024')
  const secondYear = firstYear + 1

  if (semesterType === 'WINTER') {
    return {
      startDate: new Date(`${firstYear}-10-01`),
      endDate:   new Date(`${secondYear}-02-02`),
      teachingWeeks: studyMode === 'FULL_TIME' ? 15 : 10,
    }
  } else {
    return {
      startDate: new Date(`${secondYear}-02-17`),
      endDate:   new Date(`${secondYear}-06-22`),
      teachingWeeks: studyMode === 'FULL_TIME' ? 15 : 10,
    }
  }
}


export const generateSemester = async (req: Request, res: Response) => {
  try {
    const { templateIds, academicYear, semesterType, studyMode } = req.body as {
      templateIds: string[]
      academicYear: string
      semesterType: 'WINTER' | 'SUMMER'
      studyMode: StudyMode
    }

    if (!templateIds?.length || !academicYear || !semesterType || !studyMode) {
      return res.status(400).json({ error: 'Brakujące wymagane pola: templateIds, academicYear, semesterType, studyMode' })
    }

    // Szukaj SemesterCalendar, jeśli nie ma — użyj domyślnych dat
    const savedCalendar = await prisma.semesterCalendar.findFirst({
      where: { academicYear, semesterType, studyMode },
    })
    const { startDate, endDate } = savedCalendar ?? deriveCalendarDates(academicYear, semesterType, studyMode)
    const calendar = { startDate, endDate, studyMode }

    const holidays = await prisma.publicHoliday.findMany({
      where: { date: { gte: calendar.startDate, lte: calendar.endDate } },
    })
    const holidaySet = new Set(holidays.map(h => dateToStr(h.date)))

    const templates = await prisma.scheduleTemplate.findMany({
      where: { id: { in: templateIds } },
      include: {
        curriculumEntry: { include: { subject: { select: { name: true } } } },
        studentGroup: { select: { name: true } },
        room: { select: { number: true } },
      },
    })

    const created: object[] = []
    const skipped: { templateId: string; date: string; reason: string }[] = []
    const conflicts: { templateId: string; date: string; type: string; subjectName: string; startTime: string; endTime: string; groupName: string | null; roomNumber: string }[] = []

    for (const template of templates) {
      const dates = getDatesForDayOfWeek(
        calendar.startDate,
        calendar.endDate,
        template.dayOfWeek,
        template.weekType,
      )

      // Sprawdź limit godzin z siatki przed generowaniem
      const currEntry = await prisma.curriculumEntry.findUnique({ where: { id: template.curriculumEntryId } })
      let hoursLimit = Infinity
      if (currEntry) {
        const limitMap: Record<string, number> = {
          LECTURE: currEntry.hoursLecture, EXERCISE: currEntry.hoursExercise,
          LAB: currEntry.hoursLab, PROJECT: currEntry.hoursProject, SEMINAR: currEntry.hoursSeminar,
        }
        hoursLimit = limitMap[template.classType] ?? Infinity
      }
      const existingHoursAgg = await prisma.scheduleEntry.aggregate({
        where: { curriculumEntryId: template.curriculumEntryId, classType: template.classType, status: { not: 'CANCELLED' } },
        _sum: { academicHours: true },
      })
      let accumulatedHours = existingHoursAgg._sum.academicHours ?? 0

      for (const date of dates) {
        if (isHolidayDate(date, holidaySet)) {
          skipped.push({ templateId: template.id, date: date.toISOString(), reason: 'HOLIDAY' })
          continue
        }

        if (!isInStudyModeWindow(date, calendar.studyMode, template.startTime)) {
          skipped.push({ templateId: template.id, date: date.toISOString(), reason: 'OUT_OF_WINDOW' })
          continue
        }

        // Idempotentność: jeśli wpis z tego szablonu na tę datę już istnieje — pomiń cicho
        const alreadyExists = await prisma.scheduleEntry.findFirst({
          where: { templateId: template.id, date },
        })
        if (alreadyExists) {
          accumulatedHours += template.academicHours
          skipped.push({ templateId: template.id, date: date.toISOString(), reason: 'ALREADY_EXISTS' })
          continue
        }

        if (accumulatedHours + template.academicHours > hoursLimit) {
          skipped.push({ templateId: template.id, date: date.toISOString(), reason: 'HOURS_EXCEEDED' })
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
          conflicts.push({ templateId: template.id, date: date.toISOString(), type: 'ROOM_CONFLICT', subjectName: template.curriculumEntry.subject.name, startTime: template.startTime, endTime: template.endTime, groupName: template.studentGroup?.name ?? null, roomNumber: template.room.number })
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
          conflicts.push({ templateId: template.id, date: date.toISOString(), type: 'INSTRUCTOR_CONFLICT', subjectName: template.curriculumEntry.subject.name, startTime: template.startTime, endTime: template.endTime, groupName: template.studentGroup?.name ?? null, roomNumber: template.room.number })
          continue
        }

        if (template.studentGroupId) {
          // Sprawdź całą rodzinę grupy (przodkowie + potomkowie),
          // żeby wykryć np. kolizję wykładu z ćwiczeniami tego samego rocznika.
          const familyIds = await getGroupFamilyIds(template.studentGroupId)
          const groupConflict = await prisma.scheduleEntry.findFirst({
            where: {
              studentGroupId: { in: familyIds },
              date,
              AND: [{ startTime: { lt: template.endTime } }, { endTime: { gt: template.startTime } }],
            },
          })
          if (groupConflict) {
            conflicts.push({ templateId: template.id, date: date.toISOString(), type: 'GROUP_CONFLICT', subjectName: template.curriculumEntry.subject.name, startTime: template.startTime, endTime: template.endTime, groupName: template.studentGroup?.name ?? null, roomNumber: template.room.number })
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
        accumulatedHours += template.academicHours
        created.push(entry)
      }
    }

    const alreadyExists = skipped.filter(s => s.reason === 'ALREADY_EXISTS').length
    const actualSkipped = skipped.filter(s => s.reason !== 'ALREADY_EXISTS')
    res.json({
      data: { created: created.length, skipped: actualSkipped.length, alreadyExists, conflicts: conflicts.length },
      details: { skipped: actualSkipped, conflicts },
      message: `Wygenerowano ${created.length} wpisów, pominięto ${actualSkipped.length}, już istnieje: ${alreadyExists}, konflikty: ${conflicts.length}`,
    })
  } catch (error) {
    res.status(500).json({ error: 'Błąd serwera', details: error })
  }
}
