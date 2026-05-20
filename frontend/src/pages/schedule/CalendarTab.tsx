import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  closestCenter,
} from '@dnd-kit/core'
import { scheduleApi } from '@/api/schedule'
import { groupsApi } from '@/api/groups'
import { facultiesApi, fieldsApi, specsApi } from '@/api/faculties'
import { useAcademicYearStore, SEMESTER_TYPE_NUMBERS } from '@/store/academicYearStore'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { ScheduleEntry, SemesterCalendar, DayOfWeek, StudyMode } from '@/types'
import {
  CLASS_COLORS, CLASS_LABELS, DAYS_FULL, DAYS_PART,
  END_HOUR, SLOT_HEIGHT, SLOT_MINS, SLOTS, START_MINS,
} from './lib/constants'
import { minsToTime, timeToMins } from './lib/time'
import { formatDate, getMonday, getWeekDates, isoDate } from './lib/dates'
import { getValidSlots, partTimeWindowFrom } from './lib/helpers'
import { DraggableEntryBlock } from './components/DraggableEntryBlock'
import { DroppableSlot } from './components/DroppableSlot'
import { TimeColumn } from './components/TimeColumn'
import { GroupCheckboxPicker } from './components/GroupCheckboxPicker'
import { EntryDetailPanel } from './components/EntryDetailPanel'
import { AddEntryDialog } from './dialogs/AddEntryDialog'
import { MoveEntryDialog } from './dialogs/MoveEntryDialog'
import { CalendarDialog } from './dialogs/CalendarDialog'
import { GenerateSemesterDialog } from './dialogs/GenerateSemesterDialog'

export function CalendarTab({ academicYear }: { academicYear: string }) {
  const { semesterType } = useAcademicYearStore()
  const availableSemesters = SEMESTER_TYPE_NUMBERS[semesterType]

  const [facultyId, setFacultyId] = useState('')
  const [studyMode, setStudyMode] = useState<StudyMode | ''>('')
  const [fieldOfStudyId, setFieldOfStudyId] = useState('')
  const [specializationId, setSpecializationId] = useState('')
  const [semester, setSemester] = useState('')

  const [filterGroupIds, setFilterGroupIds] = useState<Set<string> | null>(null)
  const [filterInstructorId, setFilterInstructorId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClassType, setFilterClassType] = useState('')
  const [filterRoomId, setFilterRoomId] = useState('')

  useEffect(() => {
    setFilterInstructorId('')
    setFilterClassType('')
    setFilterRoomId('')
    setFilterStatus('')
    setFilterGroupIds(null)
  }, [facultyId, fieldOfStudyId, specializationId, semester, studyMode])

  const DAYS_ALL_CAL = [...DAYS_FULL, { key: 'SATURDAY' as DayOfWeek, label: 'Sobota' }, { key: 'SUNDAY' as DayOfWeek, label: 'Niedziela' }]
  const days = studyMode === 'PART_TIME' ? DAYS_PART : studyMode === 'FULL_TIME' ? DAYS_FULL : DAYS_ALL_CAL
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null)
  const [moveState, setMoveState] = useState<{
    entry: ScheduleEntry
    targetDay: DayOfWeek
    targetSlot: string
  } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overSlot, setOverSlot] = useState<string | null>(null)
  const [showCalendarDialog, setShowCalendarDialog] = useState(false)
  const [showGenerateSemester, setShowGenerateSemester] = useState(false)
  const [addSlot, setAddSlot] = useState<{ date: string; startTime: string } | null>(null)

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const fromStr = isoDate(weekDates['MONDAY'])
  const toStr = isoDate(weekDates['SUNDAY'])

  const { data: facultiesData } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => facultiesApi.getAll(),
  })
  const { data: fieldsData } = useQuery({
    queryKey: ['fields-of-study', facultyId],
    queryFn: () => fieldsApi.getAll(facultyId || undefined),
    enabled: !!facultyId,
  })
  const { data: specsData } = useQuery({
    queryKey: ['specializations', fieldOfStudyId],
    queryFn: () => specsApi.getAll(fieldOfStudyId),
    enabled: !!fieldOfStudyId,
  })

  const { data: calendarsData } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => scheduleApi.getCalendars(),
  })
  const allCalendars: SemesterCalendar[] = calendarsData?.data.data ?? []
  const selectedCalendar = studyMode
    ? (allCalendars.find(c => c.academicYear === academicYear && c.semesterType === semesterType && c.studyMode === studyMode) ?? null)
    : (allCalendars
        .filter(c => c.academicYear === academicYear && c.semesterType === semesterType)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null)

  const derivedCalendarDates = useMemo((): { startDate: string; endDate: string } | null => {
    if (selectedCalendar) return null
    if (!academicYear || !semesterType) return null
    const firstYear = parseInt(academicYear.split('/')[0] ?? '2024')
    const secondYear = firstYear + 1
    if (semesterType === 'WINTER') {
      return { startDate: `${firstYear}-10-01`, endDate: `${secondYear}-02-02` }
    } else {
      return { startDate: `${secondYear}-02-17`, endDate: `${secondYear}-06-22` }
    }
  }, [selectedCalendar, academicYear, semesterType])

  const calMin = selectedCalendar
    ? selectedCalendar.startDate.slice(0, 10)
    : (derivedCalendarDates?.startDate ?? '')
  const calMax = selectedCalendar
    ? selectedCalendar.endDate.slice(0, 10)
    : (derivedCalendarDates?.endDate ?? '')
  const calMinMonday = calMin ? isoDate(getMonday(new Date(calMin + 'T12:00:00'))) : ''
  const calMaxMonday = calMax ? isoDate(getMonday(new Date(calMax + 'T12:00:00'))) : ''

  const calStartKey = selectedCalendar?.id ?? `${academicYear}-${semesterType}`
  useEffect(() => {
    const startDate = selectedCalendar
      ? selectedCalendar.startDate.slice(0, 10)
      : derivedCalendarDates?.startDate
    if (!startDate) return
    const current = isoDate(weekStart)
    if (!calMinMonday || !calMaxMonday || current < calMinMonday || current > calMaxMonday) {
      setWeekStart(getMonday(new Date(startDate + 'T12:00:00')))
    }
  }, [calStartKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const qc = useQueryClient()
  const deleteManyMutation = useMutation({
    mutationFn: () => scheduleApi.deleteEntries({}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entries'] }),
  })

  const { data: entriesData, refetch } = useQuery({
    queryKey: ['entries', fromStr, toStr, filterStatus],
    queryFn: () => scheduleApi.getEntries({
      from: fromStr,
      to: toStr,
      status: filterStatus || undefined,
    }),
  })

  const { data: holidaysData } = useQuery({
    queryKey: ['holidays', fromStr, toStr],
    queryFn: () => scheduleApi.getHolidays({ from: fromStr, to: toStr }),
  })

  const { data: groupsData } = useQuery({
    queryKey: ['groups-cal', academicYear, fieldOfStudyId, specializationId, semester],
    queryFn: () => groupsApi.getAll({
      academicYear,
      ...(fieldOfStudyId ? { fieldOfStudyId } : {}),
      ...(semester ? { semester: parseInt(semester) } : {}),
    }),
    enabled: !!fieldOfStudyId,
  })

  const faculties = facultiesData?.data.data ?? []
  const fields = fieldsData?.data.data ?? []
  const specs = specsData?.data.data ?? []
  const allGroups = groupsData?.data.data ?? []
  const groups = allGroups.filter(g => {
    const matchesSpec = !specializationId || g.specializationId === specializationId
    const isSN = g.name.includes('-SN-')
    const matchesMode = !studyMode || (studyMode === 'PART_TIME' ? isSN : !isSN)
    return matchesSpec && matchesMode
  })

  const groupIdSet = useMemo(
    () => fieldOfStudyId ? new Set(groups.map(g => g.id)) : null,
    [fieldOfStudyId, groups]
  )

  const allEntries = entriesData?.data.data ?? []

  const entryInstructors = useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{ id: string; firstName: string; lastName: string; title?: string | null }> = []
    for (const e of allEntries) {
      if (!seen.has(e.instructor.id)) {
        seen.add(e.instructor.id)
        result.push(e.instructor)
      }
    }
    return result.sort((a, b) => a.lastName.localeCompare(b.lastName))
  }, [allEntries])

  const entryRooms = useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{ id: string; number: string; building: { name: string } }> = []
    for (const e of allEntries) {
      if (!seen.has(e.room.id)) {
        seen.add(e.room.id)
        result.push(e.room)
      }
    }
    return result.sort((a, b) => a.number.localeCompare(b.number))
  }, [allEntries])

  const entries = allEntries.filter(e => {
    if (filterClassType && e.classType !== filterClassType) return false
    if (filterInstructorId && e.instructor.id !== filterInstructorId) return false
    if (filterRoomId && e.room.id !== filterRoomId) return false
    if (groupIdSet && !(e.studentGroup && groupIdSet.has(e.studentGroup.id))) return false
    if (filterGroupIds !== null && !(e.studentGroup && filterGroupIds.has(e.studentGroup.id))) return false
    const isSN = e.studentGroup?.name.includes('-SN-') ?? false
    if (studyMode === 'PART_TIME' && !isSN) return false
    if (studyMode === 'FULL_TIME' && isSN) return false
    return true
  })
  const holidays = holidaysData?.data.data ?? []

  const holidaySet = useMemo(() => {
    const set = new Map<string, string>()
    holidays.forEach(h => set.set(h.date.slice(0, 10), h.name))
    return set
  }, [holidays])

  const byDay = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {}
    for (const d of days) map[d.key] = []
    for (const e of entries) {
      const entryDate = e.date.slice(0, 10)
      const dayOfWeek = days.find(d => isoDate(weekDates[d.key]) === entryDate)
      if (dayOfWeek) map[dayOfWeek.key]!.push(e)
    }
    return map
  }, [entries, days, weekDates])

  const byDayAll = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {}
    for (const d of days) map[d.key] = []
    for (const e of allEntries) {
      const entryDate = e.date.slice(0, 10)
      const dayOfWeek = days.find(d => isoDate(weekDates[d.key]) === entryDate)
      if (dayOfWeek) map[dayOfWeek.key]!.push(e)
    }
    return map
  }, [allEntries, days, weekDates])

  const activeEntry = activeId ? entries.find(e => e.id === activeId) : null

  const isPartTimeEntry = !!activeEntry?.studentGroup?.name.includes('-SN-')

  const dragInfoEntry = useMemo(() => {
    if (!activeEntry) return null
    const durationMins = timeToMins(activeEntry.endTime) - timeToMins(activeEntry.startTime)
    const blockMins = durationMins
    const result: Record<string, Array<{ top: number; height: number }>> = {}
    for (const day of days) {
      if (holidaySet.has(isoDate(weekDates[day.key]))) { result[day.key] = []; continue }
      const windowFrom = isPartTimeEntry ? partTimeWindowFrom(day.key) : START_MINS
      if (windowFrom === null) { result[day.key] = []; continue }
      const occupied = (byDayAll[day.key] ?? [])
        .filter(e =>
          e.id !== activeEntry.id && (
            e.room.id === activeEntry.room.id ||
            e.instructor.id === activeEntry.instructor.id ||
            (e.studentGroup?.id && e.studentGroup.id === activeEntry.studentGroup?.id)
          )
        )
        .map(e => ({ start: timeToMins(e.startTime), end: timeToMins(e.endTime) }))
      result[day.key] = getValidSlots(occupied, blockMins, durationMins, windowFrom)
    }
    return result
  }, [activeEntry, byDayAll, days, isPartTimeEntry, holidaySet, weekDates])

  const hoverGhostEntry = useMemo(() => {
    if (!activeEntry || !overSlot) return null
    const [dayKey, slotTime] = overSlot.split('::')
    if (!dayKey || !slotTime) return null
    const startMins = timeToMins(slotTime)
    const durationMins = timeToMins(activeEntry.endTime) - timeToMins(activeEntry.startTime)
    const blockMins = durationMins
    if (startMins + blockMins > END_HOUR * 60) return null
    const proposedEnd = startMins + durationMins
    if (holidaySet.has(isoDate(weekDates[dayKey]))) {
      return { dayKey, startMins, blockMins, valid: false, conflicts: [], timeWindowViolation: false, isHoliday: true }
    }
    const others = (byDayAll[dayKey] ?? []).filter(e =>
      e.id !== activeEntry.id && (
        e.room.id === activeEntry.room.id ||
        e.instructor.id === activeEntry.instructor.id ||
        (e.studentGroup?.id && e.studentGroup.id === activeEntry.studentGroup?.id)
      )
    )
    const conflicts = others.filter(e => {
      const s = timeToMins(e.startTime), end = timeToMins(e.endTime)
      return s < proposedEnd && end > startMins
    })
    let timeWindowOk = true
    if (isPartTimeEntry) {
      const windowFrom = partTimeWindowFrom(dayKey)
      timeWindowOk = windowFrom !== null && startMins >= windowFrom && proposedEnd <= END_HOUR * 60
    }
    const timeWindowViolation = !timeWindowOk
    const valid = conflicts.length === 0 && timeWindowOk
    return { dayKey, startMins, blockMins, valid, conflicts, timeWindowViolation, isHoliday: false }
  }, [activeEntry, overSlot, byDayAll, isPartTimeEntry, holidaySet, weekDates])

  function prevWeek() {
    setWeekStart(d => {
      const n = new Date(d); n.setDate(n.getDate() - 7)
      if (calMinMonday && isoDate(n) < calMinMonday) return d
      return n
    })
  }
  function nextWeek() {
    setWeekStart(d => {
      const n = new Date(d); n.setDate(n.getDate() + 7)
      if (calMaxMonday && isoDate(n) > calMaxMonday) return d
      return n
    })
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    setOverSlot(null)
    const { over, active } = e
    if (!over) return

    const [day, slotTime] = String(over.id).split('::')
    if (!day || !slotTime) return

    const draggedEntry = entries.find(en => en.id === active.id)
    if (!draggedEntry || draggedEntry.status === 'CANCELLED') return

    const targetDay = day as DayOfWeek
    const targetDate = isoDate(weekDates[targetDay])
    const durationMins = timeToMins(draggedEntry.endTime) - timeToMins(draggedEntry.startTime)
    const newStartMins = timeToMins(slotTime)
    const newStart = minsToTime(newStartMins)

    const currentDate = draggedEntry.date.slice(0, 10)
    if (currentDate === targetDate && draggedEntry.startTime === newStart) return

    if (draggedEntry.studentGroup?.name.includes('-SN-')) {
      const windowFrom = partTimeWindowFrom(day)
      if (windowFrom === null || newStartMins < windowFrom || newStartMins + durationMins > END_HOUR * 60) return
    }

    const others = (byDayAll[day] ?? []).filter(e =>
      e.id !== draggedEntry.id && (
        e.room.id === draggedEntry.room.id ||
        e.instructor.id === draggedEntry.instructor.id ||
        (e.studentGroup?.id && e.studentGroup.id === draggedEntry.studentGroup?.id)
      )
    )
    const hasConflict = others.some(e => {
      const s = timeToMins(e.startTime), end = timeToMins(e.endTime)
      return s < newStartMins + durationMins && end > newStartMins
    })
    if (hasConflict) return

    setMoveState({ entry: draggedEntry, targetDay, targetSlot: slotTime })
  }

  const totalSlotsHeight = SLOTS.length * SLOT_HEIGHT

  return (
    <div>
      {/* Sekcja 1: Filtry kaskadowe */}
      <div className="p-3 mb-2 bg-card rounded-lg border border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Zakres widoku i generowania terminów</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs">Wydział</label>
            <Select value={facultyId || '__all__'} onValueChange={v => {
              const val = v === '__all__' ? '' : v
              setFacultyId(val); setStudyMode(''); setFieldOfStudyId(''); setSpecializationId(''); setSemester(''); setFilterGroupIds(null)
            }}>
              <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie wydziały</SelectItem>
                {faculties.map(f => <SelectItem key={f.id} value={f.id}>{f.shortName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs">Tryb</label>
            <Select value={studyMode || '__all__'} onValueChange={v => {
              setStudyMode(v === '__all__' ? '' : v as StudyMode)
              setFieldOfStudyId(''); setSpecializationId(''); setSemester(''); setFilterGroupIds(null)
            }} disabled={!facultyId}>
              <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie tryby</SelectItem>
                <SelectItem value="FULL_TIME">Stacjonarne</SelectItem>
                <SelectItem value="PART_TIME">Niestacjonarne</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs">Kierunek</label>
            <Select value={fieldOfStudyId || '__all__'} onValueChange={v => {
              const val = v === '__all__' ? '' : v
              setFieldOfStudyId(val); setSpecializationId(''); setSemester(''); setFilterGroupIds(null)
            }} disabled={!studyMode}>
              <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie kierunki</SelectItem>
                {fields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs">Specjalność</label>
            <Select value={specializationId || '__all__'} onValueChange={v => {
              const val = v === '__all__' ? '' : v
              setSpecializationId(val); setFilterGroupIds(null)
            }} disabled={!fieldOfStudyId}>
              <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie specjalności</SelectItem>
                {specs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs">Semestr</label>
            <Select value={semester || '__all__'} onValueChange={v => setSemester(v === '__all__' ? '' : v)} disabled={!specializationId}>
              <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie semestry</SelectItem>
                {availableSemesters.map(s => (
                  <SelectItem key={s} value={String(s)}>Sem. {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs">
              Grupy {filterGroupIds !== null && <span className="text-primary font-semibold">({filterGroupIds.size})</span>}
            </label>
            <GroupCheckboxPicker
              groups={groups}
              selected={filterGroupIds}
              onChange={setFilterGroupIds}
              disabled={!specializationId}
            />
          </div>

        </div>

        {(facultyId || studyMode || fieldOfStudyId || specializationId || semester || filterGroupIds !== null) && (
          <div className="mt-2">
            <Button variant="outline" size="sm" className="h-7 text-xs px-3"
              onClick={() => {
                setFacultyId(''); setStudyMode(''); setFieldOfStudyId(''); setSpecializationId(''); setSemester(''); setFilterGroupIds(null)
              }}>
              Wyczyść filtry
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
          <Button size="sm" onClick={() => setShowGenerateSemester(true)} disabled={!facultyId}>
            Generuj terminy
          </Button>
          <Button
            variant="destructive" size="sm"
            disabled={deleteManyMutation.isPending}
            onClick={() => {
              if (confirm('Usunąć WSZYSTKIE terminy z bazy danych? Tej operacji nie można cofnąć.')) {
                deleteManyMutation.mutate()
              }
            }}
          >
            {deleteManyMutation.isPending ? 'Usuwanie...' : 'Wyczyść kalendarz semestru'}
          </Button>
        </div>
      </div>

      {/* Sekcja 2: Filtry widoku + nawigacja tygodnia */}
      <div className="p-3 mb-3 bg-card rounded-lg border border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Widok</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs">Typ zajęć</label>
            <Select value={filterClassType || '__all__'} onValueChange={v => setFilterClassType(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie typy</SelectItem>
                <SelectItem value="LECTURE">Wykład</SelectItem>
                <SelectItem value="EXERCISE">Ćwiczenia</SelectItem>
                <SelectItem value="LAB">Laboratorium</SelectItem>
                <SelectItem value="PROJECT">Projekt</SelectItem>
                <SelectItem value="SEMINAR">Seminarium</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs">Prowadzący</label>
            <Select value={filterInstructorId || '__all__'} onValueChange={v => setFilterInstructorId(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszyscy prowadzący</SelectItem>
                {entryInstructors.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.title ? `${i.title} ` : ''}{i.firstName} {i.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs">Sala</label>
            <Select value={filterRoomId || '__all__'} onValueChange={v => setFilterRoomId(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie sale</SelectItem>
                {entryRooms.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.number} ({r.building.name})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs">Status</label>
            <Select value={filterStatus || '__all__'} onValueChange={v => setFilterStatus(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie statusy</SelectItem>
                <SelectItem value="SCHEDULED">Zaplanowane</SelectItem>
                <SelectItem value="CANCELLED">Odwołane</SelectItem>
                <SelectItem value="MAKEUP">Odrobienie</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(filterClassType || filterInstructorId || filterRoomId || filterStatus) && (
            <div className="flex flex-col justify-end gap-1">
              <label className="text-[11px] text-transparent select-none">_</label>
              <Button variant="outline" size="sm" className="h-8 text-xs px-3"
                onClick={() => { setFilterClassType(''); setFilterInstructorId(''); setFilterRoomId(''); setFilterStatus('') }}>
                Wyczyść
              </Button>
            </div>
          )}

          <div className="flex items-end gap-2 ml-auto">
            <div className="flex flex-col justify-end gap-1">
              <label className="text-[11px] text-transparent select-none">_</label>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setShowCalendarDialog(true)}
              >
                Edytuj kalendarz
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Nawigacja tygodnia */}
      <div className="flex items-center gap-2 mb-3">
        <Button variant="outline" size="sm" onClick={prevWeek} disabled={!!calMinMonday && isoDate(weekStart) <= calMinMonday}>← Poprzedni</Button>
        <label className="relative cursor-pointer">
          <span className="text-sm border border-border rounded px-2 py-1 bg-background text-foreground select-none">
            {weekStart.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            {' – '}
            {new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
          <input
            type="date"
            className="absolute inset-0 opacity-0 w-full cursor-pointer"
            value={isoDate(weekStart)}
            min={calMin || undefined}
            max={calMax || undefined}
            onChange={e => {
              if (e.target.value) setWeekStart(getMonday(new Date(e.target.value + 'T12:00:00')))
            }}
          />
        </label>
        <Button variant="outline" size="sm" onClick={nextWeek} disabled={!!calMaxMonday && isoDate(weekStart) >= calMaxMonday}>Następny →</Button>
      </div>

      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={(e) => setOverSlot(e.over ? String(e.over.id) : null)}
        onDragEnd={handleDragEnd}
      >
        <div className="bg-card rounded-lg border border-border overflow-auto">
          <div className="flex min-w-[700px]">
            <TimeColumn />
            {days.map((day) => {
              const dayDate = weekDates[day.key]
              const dayStr = isoDate(dayDate)
              const holidayName = holidaySet.get(dayStr)

              return (
                <div
                  key={day.key}
                  className={`flex-1 border-r border-border last:border-r-0 ${holidayName ? 'bg-red-500/5' : ''}`}
                >
                  <div className={`min-h-[3.5rem] border-b border-border flex flex-col items-center justify-center gap-0.5 text-xs font-medium px-1 ${holidayName ? 'bg-red-500/10 text-red-700 dark:text-red-400' : ''}`}>
                    <span>{day.label}</span>
                    <span className="text-[10px] opacity-70">{formatDate(dayDate)}</span>
                    {holidayName && <span className="text-[10px] text-center leading-tight">{holidayName}</span>}
                  </div>
                  <div style={{ height: totalSlotsHeight }} className="relative">
                    {holidayName && (
                      <div className="absolute inset-0 bg-red-500/15 pointer-events-none z-10" />
                    )}
                    {SLOTS.map((slot, i) => (
                      <DroppableSlot
                        key={slot}
                        id={`${day.key}::${slot}`}
                        top={i * SLOT_HEIGHT}
                        disabled={!!holidayName}
                      >
                        <div
                          onClick={() => !holidayName && !activeId && setAddSlot({ date: isoDate(weekDates[day.key]), startTime: slot })}
                          className={`w-full h-full border-t transition-colors ${
                            holidayName
                              ? 'cursor-not-allowed'
                              : 'cursor-pointer hover:bg-primary/5'
                          } ${
                            i === 0 ? 'border-transparent' :
                            slot.endsWith(':00') ? 'border-border' :
                            slot.endsWith(':30') ? 'border-border/50' :
                            'border-border/20'
                          }`}
                        />
                      </DroppableSlot>
                    ))}
                    {dragInfoEntry?.[day.key]?.map(({ top, height }, i) => (
                      <div key={`v${i}`} style={{ position: 'absolute', top, height, left: 3, right: 3, zIndex: 0 }}
                        className="rounded border border-dashed border-green-500/50 pointer-events-none" />
                    ))}
                    {hoverGhostEntry?.dayKey === day.key && (
                      <>
                        <div style={{
                          position: 'absolute',
                          top: (hoverGhostEntry.startMins - START_MINS) / SLOT_MINS * SLOT_HEIGHT,
                          height: hoverGhostEntry.blockMins / SLOT_MINS * SLOT_HEIGHT - 2,
                          left: 4, right: 4, zIndex: 5,
                        }}
                          className={`rounded border-2 pointer-events-none ${
                            hoverGhostEntry.valid
                              ? 'bg-green-500/30 border-green-400'
                              : 'bg-red-500/25 border-red-400'
                          }`}
                        />
                        {!hoverGhostEntry.valid && (
                          <div style={{
                            position: 'absolute',
                            top: (hoverGhostEntry.startMins - START_MINS) / SLOT_MINS * SLOT_HEIGHT,
                            left: 4, right: 4, zIndex: 6,
                          }}
                            className="pointer-events-none bg-red-950/95 rounded border border-red-500 px-1.5 py-1"
                          >
                            {hoverGhostEntry.isHoliday ? (
                              <p className="text-[10px] font-bold text-red-300 uppercase tracking-wide">
                                Dzień wolny
                              </p>
                            ) : hoverGhostEntry.timeWindowViolation ? (
                              <>
                                <p className="text-[10px] font-bold text-red-300 uppercase tracking-wide mb-1">
                                  Poza oknem czasowym
                                </p>
                                <p className="text-[9px] text-red-300 leading-tight">
                                  Niestacjonarne: Pt 15:00–20:00
                                </p>
                                <p className="text-[9px] text-red-300 leading-tight">
                                  Sb/Nd 07:00–20:00
                                </p>
                              </>
                            ) : hoverGhostEntry.conflicts.length > 0 && (
                              <>
                                <p className="text-[10px] font-bold text-red-300 uppercase tracking-wide mb-1">
                                  Kolizja ({hoverGhostEntry.conflicts.length})
                                </p>
                                {hoverGhostEntry.conflicts.map((e, i) => {
                                  const reasons = [
                                    e.room.id === activeEntry!.room.id && `sala ${e.room.number}`,
                                    e.instructor.id === activeEntry!.instructor.id && `${e.instructor.title ? e.instructor.title + ' ' : ''}${e.instructor.lastName}`,
                                    e.studentGroup?.id && e.studentGroup.id === activeEntry!.studentGroup?.id && `gr. ${e.studentGroup.name}`,
                                  ].filter(Boolean).join(', ')
                                  return (
                                    <div key={i} className="mb-1 last:mb-0 border-l-2 border-red-400 pl-1.5">
                                      <p className="text-[10px] font-semibold text-red-100 leading-tight">
                                        {e.curriculumEntry.subject.name}
                                      </p>
                                      <p className="text-[9px] text-red-300 leading-tight">
                                        {e.startTime}–{e.endTime}
                                      </p>
                                      <p className="text-[9px] text-orange-300 leading-tight font-medium">
                                        ↳ {reasons}
                                      </p>
                                    </div>
                                  )
                                })}
                              </>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    {byDay[day.key]?.map(entry => (
                      <DraggableEntryBlock
                        key={entry.id}
                        entry={entry}
                        onClick={() => setSelectedEntry(entry)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <DragOverlay>
          {activeEntry && (
            <div
              style={{ height: (timeToMins(activeEntry.endTime) - timeToMins(activeEntry.startTime)) / SLOT_MINS * SLOT_HEIGHT - 2 }}
              className={`rounded border-l-4 px-2 py-1 text-xs shadow-xl w-32 opacity-90 ${CLASS_COLORS[activeEntry.classType]}`}
            >
              <p className="font-semibold truncate">{activeEntry.curriculumEntry.subject.name}</p>
              <p className="truncate opacity-70">{CLASS_LABELS[activeEntry.classType]} · {activeEntry.room.number}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {entries.length === 0 && (
        <p className="text-center text-muted-foreground py-8 text-sm">
          Brak terminów w tym tygodniu. Wybierz tryb i kliknij "Generuj terminy".
        </p>
      )}

      {selectedEntry && (
        <EntryDetailPanel
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      {moveState && (
        <MoveEntryDialog
          entry={moveState.entry}
          targetDate={isoDate(weekDates[moveState.targetDay])}
          targetStartTime={moveState.targetSlot}
          targetEndTime={minsToTime(timeToMins(moveState.targetSlot) + (timeToMins(moveState.entry.endTime) - timeToMins(moveState.entry.startTime)))}
          onClose={() => setMoveState(null)}
          onSuccess={() => void refetch()}
        />
      )}

      {showCalendarDialog && (
        <CalendarDialog open onClose={() => setShowCalendarDialog(false)} />
      )}

      {showGenerateSemester && (
        <GenerateSemesterDialog
          open
          academicYear={academicYear}
          semesterType={semesterType}
          studyMode={studyMode as StudyMode}
          specializationId={specializationId || undefined}
          fieldOfStudyId={fieldOfStudyId || undefined}
          semester={semester ? parseInt(semester) : undefined}
          facultyName={faculties.find(f => f.id === facultyId)?.shortName}
          specializationName={specs.find(s => s.id === specializationId)?.name}
          fieldOfStudyName={fields.find(f => f.id === fieldOfStudyId)?.name}
          onClose={() => setShowGenerateSemester(false)}
        />
      )}

      {addSlot && (
        <AddEntryDialog
          open
          date={addSlot.date}
          startTime={addSlot.startTime}
          academicYear={academicYear}
          studyMode={(studyMode || 'FULL_TIME') as StudyMode}
          semesterType={semesterType}
          calendarId={selectedCalendar?.id}
          onClose={() => setAddSlot(null)}
          onSuccess={() => void refetch()}
        />
      )}
    </div>
  )
}
