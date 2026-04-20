import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  useDraggable,
  useDroppable,
  closestCenter,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { scheduleApi } from '@/api/schedule'
import { buildingsApi } from '@/api/buildings'
import { instructorsApi } from '@/api/instructors'
import { groupsApi } from '@/api/groups'
import { curriculumApi } from '@/api/curriculum'
import { facultiesApi, fieldsApi, specsApi } from '@/api/faculties'
import { useAcademicYearStore, SEMESTER_TYPE_NUMBERS } from '@/store/academicYearStore'
import { Pencil, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  ScheduleTemplate, ScheduleEntry, SemesterCalendar,
  ClassType, DayOfWeek, StudyMode, SemesterEntries,
} from '@/types'

// ─── Stałe ────────────────────────────────────────────────────

const DAYS_FULL: { key: DayOfWeek; label: string }[] = [
  { key: 'MONDAY',    label: 'Poniedziałek' },
  { key: 'TUESDAY',   label: 'Wtorek' },
  { key: 'WEDNESDAY', label: 'Środa' },
  { key: 'THURSDAY',  label: 'Czwartek' },
  { key: 'FRIDAY',    label: 'Piątek' },
]

const DAYS_PART: { key: DayOfWeek; label: string }[] = [
  { key: 'FRIDAY',   label: 'Piątek' },
  { key: 'SATURDAY', label: 'Sobota' },
  { key: 'SUNDAY',   label: 'Niedziela' },
]

const CLASS_COLORS: Record<ClassType, string> = {
  LECTURE:  'bg-blue-500/15   border-blue-400   text-blue-800   dark:bg-blue-500/20   dark:text-blue-300',
  EXERCISE: 'bg-green-500/15  border-green-400  text-green-800  dark:bg-green-500/20  dark:text-green-300',
  LAB:      'bg-orange-500/15 border-orange-400 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',
  PROJECT:  'bg-purple-500/15 border-purple-400 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300',
  SEMINAR:  'bg-pink-500/15   border-pink-400   text-pink-800   dark:bg-pink-500/20   dark:text-pink-300',
}

const CLASS_LABELS: Record<ClassType, string> = {
  LECTURE: 'W', EXERCISE: 'C', LAB: 'L', PROJECT: 'P', SEMINAR: 'S',
}

const WEEK_TYPE_LABELS = { EVERY: 'Co tydzień', EVEN: 'Parzyste', ODD: 'Nieparzyste' }

const CLASS_FULL_LABELS: Record<string, string> = {
  LECTURE: 'Wykład', EXERCISE: 'Ćwiczenia', LAB: 'Laboratorium', PROJECT: 'Projekt', SEMINAR: 'Seminarium',
}
const ROOM_TYPE_LABELS: Record<string, string> = {
  LECTURE: 'wykładowa', EXERCISE: 'ćwiczeniowa', LAB: 'laboratoryjna',
  COMPUTER_LAB: 'komputerowa', SEMINAR: 'seminaryjna', SPORTS: 'sportowa',
}
const DAY_SHORT: Record<string, string> = {
  MONDAY: 'pon', TUESDAY: 'wt', WEDNESDAY: 'śr', THURSDAY: 'czw',
  FRIDAY: 'pt', SATURDAY: 'sob', SUNDAY: 'nd',
}

function formatApiError(code: string, details?: Record<string, unknown>): string {
  switch (code) {
    case 'HOURS_EXCEEDED': {
      const d = details as { classType?: string; limit?: number; alreadyPlanned?: number; requested?: number; remaining?: number } | undefined
      const type = d?.classType ? (CLASS_FULL_LABELS[d.classType] ?? d.classType) : ''
      if ((d?.limit ?? 0) === 0) {
        return `Przedmiot nie ma godzin ${type ? `"${type}"` : 'tego typu'} w siatce — wybierz inny typ zajęć`
      }
      return `Przekroczono limit godzin${type ? ` (${type})` : ''} — zaplanowano już ${d?.alreadyPlanned ?? '?'}h z wymaganych ${d?.limit ?? '?'}h (pozostało ${d?.remaining ?? '?'}h, żądano ${d?.requested ?? '?'}h)`
    }
    case 'WRONG_ROOM_TYPE': {
      const d = details as { roomType?: string; classType?: string; allowed?: string[] } | undefined
      const roomType = d?.roomType ? (ROOM_TYPE_LABELS[d.roomType] ?? d.roomType) : '?'
      const classType = d?.classType ? (CLASS_FULL_LABELS[d.classType] ?? d.classType) : '?'
      const allowed = d?.allowed?.map(t => ROOM_TYPE_LABELS[t] ?? t).join(', ') ?? '?'
      return `Zły typ sali (${roomType}) — dla zajęć "${classType}" wymagana: ${allowed}`
    }
    case 'ROOM_CONFLICT': {
      const d = details as { dayOfWeek?: string; date?: string; startTime?: string; endTime?: string; roomNumber?: string; buildingName?: string } | undefined
      const when = d?.dayOfWeek ? (DAY_SHORT[d.dayOfWeek] ?? d.dayOfWeek) : (d?.date ? new Date(d.date).toLocaleDateString('pl-PL') : '?')
      const room = d?.roomNumber ? `sala ${d.roomNumber}${d.buildingName ? ` (${d.buildingName})` : ''}` : 'sala'
      return `Konflikt sali — ${room} jest zajęta: ${when} ${d?.startTime ?? ''}–${d?.endTime ?? ''}`
    }
    case 'INSTRUCTOR_CONFLICT': {
      const d = details as { dayOfWeek?: string; date?: string; startTime?: string; endTime?: string; instructorName?: string } | undefined
      const when = d?.dayOfWeek ? (DAY_SHORT[d.dayOfWeek] ?? d.dayOfWeek) : (d?.date ? new Date(d.date).toLocaleDateString('pl-PL') : '?')
      const name = d?.instructorName ?? 'prowadzący'
      return `Konflikt prowadzącego — ${name} jest zajęty: ${when} ${d?.startTime ?? ''}–${d?.endTime ?? ''}`
    }
    case 'GROUP_CONFLICT': {
      const d = details as { dayOfWeek?: string; date?: string; startTime?: string; endTime?: string; groupName?: string } | undefined
      const when = d?.dayOfWeek
        ? (DAY_SHORT[d.dayOfWeek] ?? d.dayOfWeek)
        : d?.date ? d.date.slice(0, 10).split('-').reverse().join('.') : '?'
      const group = d?.groupName ? `grupa ${d.groupName}` : 'grupa'
      return `Konflikt grupy — ${group} jest zajęta: ${when} ${d?.startTime ?? ''}–${d?.endTime ?? ''}`
    }
    default: {
      const pl: Record<string, string> = {
        HOURS_EXCEEDED: 'Przekroczono limit godzin',
        WRONG_ROOM_TYPE: 'Zły typ sali',
        ROOM_CONFLICT: 'Sala zajęta',
        INSTRUCTOR_CONFLICT: 'Prowadzący zajęty',
        GROUP_CONFLICT: 'Grupa zajęta',
        NOT_FOUND: 'Nie znaleziono',
        CONFLICT: 'Konflikt',
      }
      return pl[code] ?? code
    }
  }
}

const SLOT_MINS   = 5    // minut na jeden slot
const SLOT_HEIGHT = 7    // px per 5 min → 84 px/h (≈ poprzednie 80 px/h)
const START_HOUR  = 7
const END_HOUR    = 20
const START_MINS  = START_HOUR * 60

function generateSlots(): string[] {
  const slots: string[] = []
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINS) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots
}

const SLOTS = generateSlots()

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minsToTime(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

const ACADEMIC_HOUR_MINS = 45  // czas zajęć w jednej godzinie akademickiej
const BREAK_MINS = 15           // przerwa po każdej godzinie akademickiej
const SLOT_UNIT = ACADEMIC_HOUR_MINS + BREAK_MINS  // 60 min na siatce = 1h akademicka

// Całkowita wysokość bloku: N godzin × (45 zajęć + 15 przerwy) = N × 60 min
function blockStyle(startTime: string, endTime: string): React.CSSProperties {
  const start = timeToMins(startTime) - START_MINS
  const totalMins = timeToMins(endTime) - timeToMins(startTime)
  return {
    position: 'absolute',
    top: (start / SLOT_MINS) * SLOT_HEIGHT,
    height: (totalMins / SLOT_MINS) * SLOT_HEIGHT - 2,
    left: 4, right: 4,
    display: 'flex',
    flexDirection: 'column',
  }
}

// Tygodniowa data dla dnia tygodnia (od poniedziałku)
function getWeekDates(weekStart: Date): Record<DayOfWeek, Date> {
  const map: Partial<Record<DayOfWeek, Date>> = {}
  const days: DayOfWeek[] = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']
  days.forEach((d, i) => {
    const dt = new Date(weekStart)
    dt.setDate(weekStart.getDate() + i)
    map[d] = dt
  })
  return map as Record<DayOfWeek, Date>
}

function getMonday(d: Date): Date {
  const dt = new Date(d)
  const day = dt.getDay()
  const diff = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + diff)
  dt.setHours(0, 0, 0, 0)
  return dt
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── Draggable blok szablonu ───────────────────────────────────

function DraggableTemplateBlock({
  template,
  onClick,
}: {
  template: ScheduleTemplate
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: template.id,
    data: { type: 'template', template },
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 1,
    cursor: 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...blockStyle(template.startTime, template.endTime), ...{ transform: style.transform, opacity: style.opacity, zIndex: style.zIndex, cursor: style.cursor } }}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`group rounded border-l-4 text-xs overflow-hidden transition-opacity ${CLASS_COLORS[template.classType]}`}
    >
      <div className="px-2 py-1 overflow-hidden h-full relative">
        <button
          className="absolute top-0.5 right-0.5 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-black/20 dark:hover:bg-white/20 transition-opacity z-10"
          onPointerDown={e => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onClick() }}
          title="Edytuj wzorzec"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <p className="font-semibold truncate leading-tight pr-4">{template.curriculumEntry.subject.name}</p>
        <p className="truncate opacity-70">
          {CLASS_LABELS[template.classType]} · {template.room.number} · {WEEK_TYPE_LABELS[template.weekType]}
        </p>
        <p className="truncate opacity-60">{template.startTime}–{template.endTime}</p>
        <p className="truncate opacity-60">
          {template.instructor.title ? `${template.instructor.title} ` : ''}{template.instructor.lastName}
        </p>
        {template.studentGroup && (
          <p className="truncate opacity-60">{template.studentGroup.name}</p>
        )}
      </div>
    </div>
  )
}

// ─── Draggable blok wpisu ─────────────────────────────────────

function DraggableEntryBlock({
  entry,
  onClick,
}: {
  entry: ScheduleEntry
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    data: { type: 'entry', entry },
  })

  const isCancelled = entry.status === 'CANCELLED'
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 1,
    cursor: isCancelled ? 'default' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...blockStyle(entry.startTime, entry.endTime), ...{ transform: style.transform, opacity: style.opacity, zIndex: style.zIndex, cursor: style.cursor } }}
      {...(isCancelled ? {} : { ...listeners, ...attributes })}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`group rounded border-l-4 text-xs overflow-hidden transition-opacity ${CLASS_COLORS[entry.classType]} ${isCancelled ? 'opacity-50' : ''}`}
    >
      <div className="px-2 py-1 overflow-hidden h-full relative">
        <button
          className="absolute top-0.5 right-0.5 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-black/20 dark:hover:bg-white/20 transition-opacity z-10"
          onPointerDown={e => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onClick() }}
          title="Szczegóły / edycja"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <p className={`font-semibold truncate leading-tight pr-4 ${isCancelled ? 'line-through' : ''}`}>{entry.curriculumEntry.subject.name}</p>
        <p className="truncate opacity-70">
          {CLASS_LABELS[entry.classType]} · {entry.room.number}
          {entry.status === 'CANCELLED' && ' · Odwołane'}
          {entry.status === 'MAKEUP' && ' · Odrobienie'}
        </p>
        <p className="truncate opacity-60">{entry.startTime}–{entry.endTime}</p>
        <p className="truncate opacity-60">
          {entry.instructor.title ? `${entry.instructor.title} ` : ''}{entry.instructor.lastName}
        </p>
        {entry.studentGroup && (
          <p className="truncate opacity-60">{entry.studentGroup.name}</p>
        )}
      </div>
    </div>
  )
}

// ─── Droppable slot ───────────────────────────────────────────

function DroppableSlot({
  id,
  children,
  onClick,
  top,
  disabled,
}: {
  id: string
  children?: React.ReactNode
  onClick?: () => void
  top: number
  disabled?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled })
  return (
    <div
      ref={setNodeRef}
      onClick={disabled ? undefined : onClick}
      className="absolute w-full"
      style={{ height: SLOT_HEIGHT, top }}
    >
      {children}
    </div>
  )
}

// ─── Kolumna czasu ────────────────────────────────────────────

function TimeColumn() {
  return (
    <div className="w-14 flex-shrink-0 border-r border-border">
      <div className="h-10 border-b border-border" />
      <div style={{ height: SLOTS.length * SLOT_HEIGHT }} className="relative">
        {SLOTS.map((slot, i) => {
          const isHour = slot.endsWith(':00')
          return (
            <div
              key={slot}
              style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
              className="absolute w-full flex items-start justify-end pr-1"
            >
              {isHour && (
                <span className="text-[10px] text-muted-foreground leading-none">{slot}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Dialog dodawania szablonu ────────────────────────────────

// Extended Specialization type including fieldOfStudy→faculty chain (returned by backend)
type SpecWithChain = {
  id: string
  name: string
  shortName: string
  fieldOfStudyId: string
  fieldOfStudy?: {
    id: string
    name: string
    shortName: string
    facultyId: string
    faculty?: { id: string; name: string; shortName: string }
  }
}

// Room types allowed per class type
const ROOM_TYPES_FOR_CLASS: Record<string, string[]> = {
  LECTURE:  ['LECTURE'],
  EXERCISE: ['EXERCISE', 'LECTURE'],
  LAB:      ['LAB', 'COMPUTER_LAB'],
  PROJECT:  ['EXERCISE', 'COMPUTER_LAB', 'SEMINAR'],
  SEMINAR:  ['SEMINAR', 'EXERCISE'],
}

type AddTemplateForm = {
  curriculumEntryId: string
  classType: string
  academicHours: string
  dayOfWeek: string
  weekType: string
  startTime: string
  endTime: string
  roomId: string
  instructorId: string
}

function AddTemplateDialog({
  open,
  prefill,
  semester,
  academicYear,
  studyMode,
  onClose,
  onSuccess,
}: {
  open: boolean
  prefill?: { dayOfWeek: string; startTime: string }
  semester: number
  academicYear: string
  studyMode: StudyMode
  onClose: () => void
  onSuccess: () => void
}) {
  const qc = useQueryClient()

  // ── Filter state (cascade) ────────────────────────────────────
  const [facultyId,      setFacultyId]      = useState('')
  const [fieldId,        setFieldId]        = useState('')
  const [specId,         setSpecId]         = useState('')
  const [effectiveMode,  setEffectiveMode]  = useState<string>(studyMode ?? 'FULL_TIME')
  const [groupId,        setGroupId]        = useState('')

  // ── Form state ────────────────────────────────────────────────
  const emptyForm = (): AddTemplateForm => ({
    curriculumEntryId: '',
    classType: '',
    academicHours: '2',
    dayOfWeek: prefill?.dayOfWeek ?? 'MONDAY',
    startTime: prefill?.startTime ?? '08:00',
    endTime: prefill?.startTime ? minsToTime(timeToMins(prefill.startTime) + 90) : '09:30',
    weekType: 'EVERY',
    roomId: '',
    instructorId: '',
  })
  const [form, setForm] = useState<AddTemplateForm>(emptyForm)
  const [error, setError] = useState('')

  // Reset everything when dialog opens
  useEffect(() => {
    if (!open) return
    setFacultyId(''); setFieldId(''); setSpecId('')
    setEffectiveMode(studyMode ?? 'FULL_TIME')
    setGroupId('')
    setForm(emptyForm())
    setError('')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Queries ───────────────────────────────────────────────────
  const { data: facultiesData } = useQuery({
    queryKey: ['faculties'],
    queryFn:  () => facultiesApi.getAll(),
    enabled: open,
  })
  const { data: allSpecsData } = useQuery({
    queryKey: ['specializations-all'],
    queryFn:  () => specsApi.getAll(),
    enabled: open,
  })
  const { data: versionsData } = useQuery({
    queryKey: ['curriculum-versions'],
    queryFn:  () => curriculumApi.getVersions(),
    enabled: open,
  })
  const { data: groupsData } = useQuery({
    queryKey: ['groups', semester, academicYear],
    queryFn:  () => groupsApi.getAll({ semester, academicYear }),
    enabled: open,
  })
  const { data: buildingsData } = useQuery({
    queryKey: ['buildings'],
    queryFn:  () => buildingsApi.getAll(),
    enabled: open,
  })
  const { data: instructorsData } = useQuery({
    queryKey: ['instructors'],
    queryFn:  () => instructorsApi.getAll(),
    enabled: open,
  })

  // ── Derived data ──────────────────────────────────────────────
  const faculties   = facultiesData?.data.data  ?? []
  const allSpecs    = (allSpecsData?.data.data  ?? []) as SpecWithChain[]
  const versions    = versionsData?.data.data   ?? []
  const groups      = groupsData?.data.data     ?? []
  const allRooms    = buildingsData?.data.data.flatMap(b => b.rooms.map(r => ({ ...r, buildingName: b.name }))) ?? []
  const instructors = instructorsData?.data.data ?? []

  const selectedGroup   = groups.find(g => g.id === groupId)
  const effectiveSemester = selectedGroup?.semester ?? semester

  // Cascading filter lists derived from allSpecs
  const filteredFields = useMemo(() => {
    const seen = new Set<string>()
    return allSpecs
      .filter(s => !facultyId || s.fieldOfStudy?.facultyId === facultyId)
      .flatMap(s => s.fieldOfStudy ? [s.fieldOfStudy] : [])
      .filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true })
  }, [allSpecs, facultyId])

  const filteredSpecs = useMemo(() =>
    allSpecs.filter(s => !fieldId || s.fieldOfStudy?.id === fieldId),
    [allSpecs, fieldId]
  )

  const filteredGroups = useMemo(() =>
    groups.filter(g => !specId || g.specializationId === specId),
    [groups, specId]
  )

  // Active curriculum version for the selected spec + study mode
  const activeVersion = useMemo(() =>
    versions.find(v => v.specialization?.id === specId && v.studyMode === effectiveMode && v.isActive),
    [versions, specId, effectiveMode]
  )

  const { data: entriesData } = useQuery({
    queryKey: ['curriculum-entries', activeVersion?.id, effectiveSemester],
    queryFn:  () => curriculumApi.getEntries(activeVersion!.id, effectiveSemester),
    enabled: open && !!activeVersion?.id,
  })
  const semEntries: SemesterEntries[] = entriesData?.data.data?.semesters ?? []
  const curriculumEntries = semEntries.flatMap(s => s.entries)

  // Class types available for the selected curriculum entry (those with hours > 0)
  const selectedEntry = curriculumEntries.find(e => e.id === form.curriculumEntryId)
  const availableClassTypes = useMemo((): ClassType[] => {
    if (!selectedEntry) return ['LECTURE', 'EXERCISE', 'LAB', 'PROJECT', 'SEMINAR']
    return (['LECTURE', 'EXERCISE', 'LAB', 'PROJECT', 'SEMINAR'] as ClassType[]).filter(t => {
      const key = { LECTURE: 'hoursLecture', EXERCISE: 'hoursExercise', LAB: 'hoursLab', PROJECT: 'hoursProject', SEMINAR: 'hoursSeminar' }[t]
      return (selectedEntry as unknown as Record<string, number>)[key] > 0
    })
  }, [selectedEntry])

  // Rooms filtered by class type
  const filteredRooms = useMemo(() => {
    const allowed = form.classType ? (ROOM_TYPES_FOR_CLASS[form.classType] ?? null) : null
    return allowed ? allRooms.filter(r => allowed.includes(r.type)) : allRooms
  }, [allRooms, form.classType])

  // Days filtered by study mode
  const DAYS_ALL = [...DAYS_FULL, { key: 'SATURDAY' as DayOfWeek, label: 'Sobota' }, { key: 'SUNDAY' as DayOfWeek, label: 'Niedziela' }]
  const days = effectiveMode === 'PART_TIME' ? DAYS_PART : effectiveMode === 'FULL_TIME' ? DAYS_FULL : DAYS_ALL

  // ── Handlers ──────────────────────────────────────────────────
  const handleGroupSelect = (gId: string) => {
    const g = groups.find(x => x.id === gId)
    if (!g) { setGroupId(''); return }
    setGroupId(gId)

    // Auto-fill filter cascade from group's specialization chain
    if (g.specializationId) {
      const spec = allSpecs.find(s => s.id === g.specializationId)
      if (spec) {
        setSpecId(g.specializationId)
        setFieldId(spec.fieldOfStudy?.id ?? g.fieldOfStudyId)
        setFacultyId(spec.fieldOfStudy?.facultyId ?? '')
      }
    } else {
      setFieldId(g.fieldOfStudyId)
    }

    // Auto-suggest class type from group type
    const classType = g.type as string

    // Auto-suggest room: prefer group's preferredRoomId, else first room matching class type
    let autoRoomId = ''
    if (g.preferredRoomId) {
      autoRoomId = g.preferredRoomId
    } else {
      const allowed = ROOM_TYPES_FOR_CLASS[classType] ?? []
      const match = allRooms.find(r => allowed.includes(r.type))
      autoRoomId = match?.id ?? ''
    }

    setForm(f => ({ ...f, classType, curriculumEntryId: '', roomId: autoRoomId }))
  }

  // ── Mutation ──────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => scheduleApi.createTemplate({
      curriculumEntryId: form.curriculumEntryId,
      classType: form.classType,
      academicHours: Number(form.academicHours),
      roomId: form.roomId,
      instructorId: form.instructorId,
      studentGroupId: groupId || undefined,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      semester: effectiveSemester,
      academicYear,
      weekType: form.weekType,
      studyMode: effectiveMode as StudyMode,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['templates-all'] })
      onSuccess()
      onClose()
    },
    onError: (e: unknown) => {
      const data = (e as { response?: { data?: { error?: string; details?: Record<string, unknown> } } })?.response?.data
      setError(data?.error ? formatApiError(data.error, data.details) : 'Błąd zapisu — spróbuj ponownie')
    },
  })

  const canSubmit = !!groupId && !!form.curriculumEntryId && !!form.classType && !!form.roomId && !!form.instructorId

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dodaj zajęcia do wzorca</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* ── Sekcja 1: Zawężenie (kaskadowe filtry) ── */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Zawężenie</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Wydział</Label>
                <Select value={facultyId} onValueChange={v => {
                  setFacultyId(v); setFieldId(''); setSpecId(''); setGroupId('')
                  setForm(f => ({ ...f, curriculumEntryId: '', classType: '', roomId: '' }))
                }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Wszystkie" /></SelectTrigger>
                  <SelectContent>
                    {faculties.map(f => <SelectItem key={f.id} value={f.id}>{f.shortName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tryb</Label>
                <Select value={effectiveMode} onValueChange={v => {
                  setEffectiveMode(v); setGroupId('')
                  setForm(f => ({ ...f, curriculumEntryId: '', dayOfWeek: v === 'PART_TIME' ? 'FRIDAY' : 'MONDAY' }))
                }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL_TIME">Stacjonarne</SelectItem>
                    <SelectItem value="PART_TIME">Niestacjonarne</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Kierunek</Label>
                <Select value={fieldId} onValueChange={v => {
                  setFieldId(v); setSpecId(''); setGroupId('')
                  setForm(f => ({ ...f, curriculumEntryId: '', classType: '', roomId: '' }))
                }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Wszystkie" /></SelectTrigger>
                  <SelectContent>
                    {filteredFields.map(f => <SelectItem key={f.id} value={f.id}>{f.shortName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Specjalność</Label>
                <Select value={specId} onValueChange={v => {
                  setSpecId(v); setGroupId('')
                  setForm(f => ({ ...f, curriculumEntryId: '', classType: '', roomId: '' }))
                }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Wszystkie" /></SelectTrigger>
                  <SelectContent>
                    {filteredSpecs.map(s => <SelectItem key={s.id} value={s.id}>{s.shortName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── Sekcja 2: Grupa (obowiązkowa, auto-wypełnia filtry) ── */}
          <div className="space-y-1">
            <Label>Grupa <span className="text-destructive">*</span></Label>
            <Select value={groupId} onValueChange={handleGroupSelect}>
              <SelectTrigger><SelectValue placeholder="Wybierz grupę" /></SelectTrigger>
              <SelectContent>
                {filteredGroups.length === 0
                  ? <div className="px-2 py-1.5 text-xs text-muted-foreground">Brak grup dla wybranych filtrów</div>
                  : filteredGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)
                }
              </SelectContent>
            </Select>
          </div>

          {/* ── Sekcja 3: Przedmiot + szczegóły zajęć ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Przedmiot <span className="text-destructive">*</span></Label>
              <Select
                value={form.curriculumEntryId}
                onValueChange={v => {
                  // When entry changes, reset classType if no longer valid (has no hours for that type)
                  const entry = curriculumEntries.find(e => e.id === v)
                  const hoursMap: Record<ClassType, number> = {
                    LECTURE: entry?.hoursLecture ?? 0, EXERCISE: entry?.hoursExercise ?? 0,
                    LAB: entry?.hoursLab ?? 0, PROJECT: entry?.hoursProject ?? 0, SEMINAR: entry?.hoursSeminar ?? 0,
                  }
                  setForm(f => ({
                    ...f,
                    curriculumEntryId: v,
                    classType: f.classType && hoursMap[f.classType as ClassType] > 0 ? f.classType : '',
                    roomId: '',
                  }))
                }}
                disabled={!activeVersion}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !specId ? 'Najpierw wybierz grupę' :
                    !activeVersion ? 'Brak aktywnego planu dla trybu' :
                    'Wybierz przedmiot'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {curriculumEntries.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.subject.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Typ zajęć <span className="text-destructive">*</span></Label>
              <Select value={form.classType} onValueChange={v => setForm(f => ({ ...f, classType: v, roomId: '' }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz typ" /></SelectTrigger>
                <SelectContent>
                  {availableClassTypes.map(t => (
                    <SelectItem key={t} value={t}>{CLASS_LABELS[t]} – {t}</SelectItem>
                  ))}
                  {availableClassTypes.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Brak typów zajęć dla tego przedmiotu</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Godz. dydakt.</Label>
              <Input type="number" min={1} max={6} value={form.academicHours}
                onChange={e => setForm(f => ({ ...f, academicHours: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label>Dzień tygodnia</Label>
              <Select value={form.dayOfWeek} onValueChange={v => setForm(f => ({ ...f, dayOfWeek: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {days.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Cykl</Label>
              <Select value={form.weekType} onValueChange={v => setForm(f => ({ ...f, weekType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EVERY">Co tydzień</SelectItem>
                  <SelectItem value="EVEN">Tygodnie parzyste</SelectItem>
                  <SelectItem value="ODD">Tygodnie nieparzyste</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Godzina od</Label>
              <Input type="time" value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label>Godzina do</Label>
              <Input type="time" value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>

          {/* ── Sekcja 4: Sala i prowadzący ── */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>
                Sala
                {form.classType && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (filtrowana: {(ROOM_TYPES_FOR_CLASS[form.classType] ?? []).join(', ')})
                  </span>
                )}
              </Label>
              <Select value={form.roomId} onValueChange={v => setForm(f => ({ ...f, roomId: v }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz salę" /></SelectTrigger>
                <SelectContent>
                  {filteredRooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.number} ({r.type}, poj. {r.capacity}) – {(r as { buildingName?: string }).buildingName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Prowadzący</Label>
              <Select value={form.instructorId} onValueChange={v => setForm(f => ({ ...f, instructorId: v }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz prowadzącego" /></SelectTrigger>
                <SelectContent>
                  {instructors.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.title ? `${i.title} ` : ''}{i.firstName} {i.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !canSubmit}>
            {mutation.isPending ? 'Zapisywanie...' : 'Dodaj'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialog edycji szablonu ───────────────────────────────────

function EditTemplateDialog({
  template,
  onClose,
  onSuccess,
}: {
  template: ScheduleTemplate
  onClose: () => void
  onSuccess: () => void
}) {
  const qc = useQueryClient()
  const [weekType, setWeekType]       = useState(template.weekType)
  const [startTime, setStartTime]     = useState(template.startTime)
  const [endTime, setEndTime]         = useState(template.endTime)
  const [instructorId, setInstructorId] = useState(template.instructor.id)
  const [roomId, setRoomId]           = useState(template.room.id)
  const [error, setError]             = useState('')

  const { data: instructorsData } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.getAll(),
  })
  const { data: buildingsData } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => buildingsApi.getAll(),
  })

  const instructors = instructorsData?.data.data ?? []
  const allRooms = buildingsData?.data.data.flatMap(b =>
    b.rooms.map(r => ({ ...r, buildingName: b.name }))
  ) ?? []
  const allowedRoomTypes = ROOM_TYPES_FOR_CLASS[template.classType] ?? []
  const filteredRooms = allRooms.filter(r => allowedRoomTypes.includes(r.type))

  const updateMutation = useMutation({
    mutationFn: () => scheduleApi.updateTemplate(template.id, { weekType, startTime, endTime, instructorId, roomId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); qc.invalidateQueries({ queryKey: ['templates-all'] }); onSuccess(); onClose() },
    onError: (e: unknown) => {
      const data = (e as { response?: { data?: { error?: string; details?: Record<string, unknown> } } })?.response?.data
      setError(data?.error ? formatApiError(data.error, data.details) : 'Błąd zapisu — spróbuj ponownie')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => scheduleApi.deleteTemplate(template.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); qc.invalidateQueries({ queryKey: ['templates-all'] }); onClose() },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edytuj wzorzec zajęć</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="rounded-md bg-muted/50 px-3 py-2 space-y-0.5 text-xs text-muted-foreground">
            <p><span className="font-medium text-foreground">{template.curriculumEntry.subject.name}</span></p>
            <p>{CLASS_LABELS[template.classType]} · {DAY_SHORT[template.dayOfWeek] ?? template.dayOfWeek}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Od</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Do</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Cykl</Label>
              <Select value={weekType} onValueChange={v => setWeekType(v as typeof weekType)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EVERY">Co tydzień</SelectItem>
                  <SelectItem value="EVEN">Tygodnie parzyste</SelectItem>
                  <SelectItem value="ODD">Tygodnie nieparzyste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Prowadzący</Label>
              <Select value={instructorId} onValueChange={setInstructorId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {instructors.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.title ? `${i.title} ` : ''}{i.firstName} {i.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Sala</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {filteredRooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.number} ({r.buildingName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { if (confirm('Usunąć ten wzorzec?')) deleteMutation.mutate() }}
            disabled={deleteMutation.isPending}
          >
            Usuń
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Anuluj</Button>
            <Button onClick={() => { setError(''); updateMutation.mutate() }} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialog generowania semestru ──────────────────────────────

function GenerateSemesterDialog({
  open,
  templates,
  academicYear,
  semesterType,
  onClose,
}: {
  open: boolean
  templates: Pick<ScheduleTemplate, 'id' | 'studyMode'>[]
  academicYear: string
  semesterType: string
  onClose: () => void
}) {
  type ConflictDetail = { date: string; type: string; subjectName: string; startTime: string; endTime: string; groupName: string | null; roomNumber: string }
  const [result, setResult] = useState<{ created: number; alreadyExists: number; conflicts: number; conflictDetails: ConflictDetail[] } | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const qc = useQueryClient()

  // Pogrupuj szablony po studyMode
  const groups = useMemo(() => {
    const map = new Map<StudyMode, string[]>()
    for (const t of templates) {
      if (!map.has(t.studyMode)) map.set(t.studyMode, [])
      map.get(t.studyMode)!.push(t.id)
    }
    return Array.from(map.entries()).map(([mode, ids]) => ({ mode, ids }))
  }, [templates])

  async function handleGenerate() {
    setPending(true)
    setError('')
    let created = 0, alreadyExists = 0, conflicts = 0
    const conflictDetails: ConflictDetail[] = []
    for (const { mode, ids } of groups) {
      try {
        const res = await scheduleApi.generateSemester({
          templateIds: ids,
          academicYear,
          semesterType,
          studyMode: mode,
        })
        created += res.data.data.created
        alreadyExists += (res.data.data as { alreadyExists?: number }).alreadyExists ?? 0
        conflicts += res.data.data.conflicts
        const resDetails = (res.data as { details?: { conflicts?: ConflictDetail[] } }).details
        conflictDetails.push(...(resDetails?.conflicts ?? []))
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd'
        setError(prev => prev ? `${prev}; ${msg}` : msg)
      }
    }
    qc.invalidateQueries({ queryKey: ['entries'] })
    setResult({ created, alreadyExists, conflicts, conflictDetails })
    setPending(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !pending) onClose() }}>
      <DialogContent className="max-w-sm" onInteractOutside={(e) => { if (pending) e.preventDefault() }} onEscapeKeyDown={(e) => { if (pending) e.preventDefault() }}>
        <DialogHeader>
          <DialogTitle>Generuj terminy semestru</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result ? (
            <div className="text-sm space-y-2">
              <p className="text-green-600 font-medium">Gotowe!</p>
              <p>Utworzono: <b>{result.created}</b> terminów</p>
              {result.alreadyExists > 0 && (
                <p className="text-muted-foreground">Już istniało: <b>{result.alreadyExists}</b> (pominięto)</p>
              )}
              <p className={result.conflicts > 0 ? 'text-destructive' : ''}>Konflikty: <b>{result.conflicts}</b></p>
              {result.conflictDetails.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded border border-destructive/40 bg-destructive/5">
                  {result.conflictDetails.map((c, i) => (
                    <div key={i} className="px-2 py-1.5 border-b border-destructive/20 last:border-b-0">
                      <p className="font-medium truncate">{c.subjectName}</p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(c.date).toLocaleDateString('pl-PL')} · {c.startTime}–{c.endTime} · {c.roomNumber}
                        {c.groupName && ` · ${c.groupName}`}
                      </p>
                      <p className="text-destructive/80 text-xs">
                        {c.type === 'ROOM_CONFLICT' ? 'sala zajęta' : c.type === 'INSTRUCTOR_CONFLICT' ? 'prowadzący zajęty' : 'grupa zajęta'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Kontekst: <b>{academicYear} · {semesterType === 'WINTER' ? 'zimowy' : 'letni'}</b>
              </p>
              {groups.length === 0 ? (
                <p className="text-sm text-destructive">Brak wzorców pasujących do filtrów.</p>
              ) : (
                <div className="space-y-1">
                  {groups.map(({ mode, ids }) => (
                    <p key={mode} className="text-sm text-muted-foreground">
                      · {mode === 'FULL_TIME' ? 'Stacjonarne' : 'Niestacjonarne'} — {ids.length} wzorców
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {result ? 'Zamknij' : 'Anuluj'}
          </Button>
          {!result && (
            <Button
              onClick={() => void handleGenerate()}
              disabled={pending || groups.length === 0}
            >
              {pending ? 'Generowanie...' : 'Generuj'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialog kalendarza semestru ───────────────────────────────

function CalendarDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { academicYear, semesterType } = useAcademicYearStore()
  const [form, setForm] = useState({
    academicYear,
    semesterType: semesterType as 'WINTER' | 'SUMMER',
    studyMode: 'FULL_TIME' as StudyMode,
    startDate: '',
    endDate: '',
    teachingWeeks: '15',
  })
  const [error, setError] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => scheduleApi.getCalendars(),
    enabled: open,
  })
  const calendars = existing?.data.data ?? []

  const mutation = useMutation({
    mutationFn: () => scheduleApi.createCalendar({
      academicYear: form.academicYear,
      semesterType: form.semesterType,
      studyMode: form.studyMode,
      startDate: form.startDate,
      endDate: form.endDate,
      teachingWeeks: Number(form.teachingWeeks),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendars'] }); setError('') },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scheduleApi.deleteCalendar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendars'] }),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Kalendarze semestrów</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {calendars.length > 0 && (
            <div className="space-y-2">
              {calendars.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm p-2 bg-muted/40 rounded">
                  <span>{c.academicYear} · {c.semesterType} · {c.studyMode === 'FULL_TIME' ? 'St.' : 'Nst.'} · {c.teachingWeeks} tyg.</span>
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(c.id)}>✕</Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm font-medium">Nowy kalendarz</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Rok akademicki</Label>
              <Input value={form.academicYear} onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))} placeholder="2024/2025" />
            </div>
            <div className="space-y-1">
              <Label>Semestr</Label>
              <Select value={form.semesterType} onValueChange={v => setForm(f => ({ ...f, semesterType: v as 'WINTER' | 'SUMMER' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WINTER">Zimowy</SelectItem>
                  <SelectItem value="SUMMER">Letni</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tryb</Label>
              <Select value={form.studyMode} onValueChange={v => setForm(f => ({ ...f, studyMode: v as StudyMode }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_TIME">Stacjonarne</SelectItem>
                  <SelectItem value="PART_TIME">Niestacjonarne</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tygodni</Label>
              <Input type="number" value={form.teachingWeeks} onChange={e => setForm(f => ({ ...f, teachingWeeks: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Data początku</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Data końca</Label>
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zamknij</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.startDate || !form.endDate}
          >
            {mutation.isPending ? 'Dodawanie...' : 'Dodaj'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialog ręcznego dodawania terminu ───────────────────────

function AddEntryDialog({
  open, date, startTime, academicYear, studyMode, semesterType, calendarId, onClose, onSuccess,
}: {
  open: boolean
  date: string        // ISO date "2024-10-25"
  startTime: string   // "08:00"
  academicYear: string
  studyMode: StudyMode
  semesterType: string
  calendarId?: string
  onClose: () => void
  onSuccess: () => void
}) {
  const qc = useQueryClient()
  const [facultyId, setFacultyId] = useState('')
  const [fieldId,   setFieldId]   = useState('')
  const [specId,    setSpecId]    = useState('')
  const [groupId,   setGroupId]   = useState('')
  const [scope, setScope] = useState<'ONE' | 'EVERY' | 'EVEN' | 'ODD'>('ONE')
  const [form, setForm] = useState({
    curriculumEntryId: '',
    classType: '' as ClassType | '',
    academicHours: '2',
    startTime,
    endTime: minsToTime(timeToMins(startTime) + 90),
    roomId: '',
    instructorId: '',
    status: 'MAKEUP' as 'MAKEUP' | 'SCHEDULED',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setFacultyId(''); setFieldId(''); setSpecId(''); setGroupId('')
    setScope('ONE')
    setForm({ curriculumEntryId: '', classType: '', academicHours: '2', startTime, endTime: minsToTime(timeToMins(startTime) + 90), roomId: '', instructorId: '', status: 'MAKEUP' })
    setError('')
  }, [open, startTime]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: facultiesData }    = useQuery({ queryKey: ['faculties'],            queryFn: () => facultiesApi.getAll(),    enabled: open })
  const { data: allSpecsData }     = useQuery({ queryKey: ['specializations-all'],  queryFn: () => specsApi.getAll(),        enabled: open })
  const { data: versionsData }     = useQuery({ queryKey: ['curriculum-versions'],  queryFn: () => curriculumApi.getVersions(), enabled: open })
  const { data: groupsData }       = useQuery({ queryKey: ['groups-add', academicYear], queryFn: () => groupsApi.getAll({ academicYear }), enabled: open })
  const { data: buildingsData }    = useQuery({ queryKey: ['buildings'],             queryFn: () => buildingsApi.getAll(),   enabled: open })
  const { data: instructorsData }  = useQuery({ queryKey: ['instructors'],           queryFn: () => instructorsApi.getAll(), enabled: open })

  const faculties   = facultiesData?.data.data ?? []
  const allSpecs    = (allSpecsData?.data.data ?? []) as SpecWithChain[]
  const versions    = versionsData?.data.data ?? []
  const groups      = groupsData?.data.data ?? []
  const allRooms    = buildingsData?.data.data.flatMap(b => b.rooms.map(r => ({ ...r, buildingName: b.name }))) ?? []
  const instructors = instructorsData?.data.data ?? []

  const filteredFields = useMemo(() => {
    const seen = new Set<string>()
    return allSpecs.filter(s => !facultyId || s.fieldOfStudy?.facultyId === facultyId)
      .flatMap(s => s.fieldOfStudy ? [s.fieldOfStudy] : [])
      .filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true })
  }, [allSpecs, facultyId])

  const filteredSpecs  = useMemo(() => allSpecs.filter(s => !fieldId || s.fieldOfStudy?.id === fieldId), [allSpecs, fieldId])
  const filteredGroups = useMemo(() => {
    const isSN = studyMode === 'PART_TIME'
    return groups.filter(g =>
      (!specId || g.specializationId === specId) &&
      (isSN ? g.name.includes('-SN-') : !g.name.includes('-SN-'))
    )
  }, [groups, specId, studyMode])

  const selectedGroup = groups.find(g => g.id === groupId)
  const activeVersion = useMemo(() =>
    versions.find(v => v.specialization?.id === specId && v.studyMode === studyMode && v.isActive),
    [versions, specId, studyMode]
  )

  const { data: entriesData } = useQuery({
    queryKey: ['curriculum-entries', activeVersion?.id, selectedGroup?.semester],
    queryFn:  () => curriculumApi.getEntries(activeVersion!.id, selectedGroup!.semester),
    enabled: open && !!activeVersion?.id && !!selectedGroup?.semester,
  })
  const curriculumEntries = (entriesData?.data.data?.semesters ?? []).flatMap((s: SemesterEntries) => s.entries)

  const selectedEntry = curriculumEntries.find(e => e.id === form.curriculumEntryId)
  const availableClassTypes = useMemo((): ClassType[] => {
    if (!selectedEntry) return ['LECTURE', 'EXERCISE', 'LAB', 'PROJECT', 'SEMINAR']
    return (['LECTURE', 'EXERCISE', 'LAB', 'PROJECT', 'SEMINAR'] as ClassType[]).filter(t => {
      const key = { LECTURE: 'hoursLecture', EXERCISE: 'hoursExercise', LAB: 'hoursLab', PROJECT: 'hoursProject', SEMINAR: 'hoursSeminar' }[t]
      return (selectedEntry as unknown as Record<string, number>)[key] > 0
    })
  }, [selectedEntry])

  const filteredRooms = useMemo(() => {
    const allowed = form.classType ? (ROOM_TYPES_FOR_CLASS[form.classType] ?? null) : null
    return allowed ? allRooms.filter(r => allowed.includes(r.type)) : allRooms
  }, [allRooms, form.classType])

  const handleGroupSelect = (gId: string) => {
    const g = groups.find(x => x.id === gId)
    if (!g) { setGroupId(''); return }
    setGroupId(gId)
    if (g.specializationId) {
      const spec = allSpecs.find(s => s.id === g.specializationId)
      if (spec) { setSpecId(g.specializationId); setFieldId(spec.fieldOfStudy?.id ?? g.fieldOfStudyId); setFacultyId(spec.fieldOfStudy?.facultyId ?? '') }
    } else {
      setFieldId(g.fieldOfStudyId)
    }
    const classType = g.type as string
    const allowed = ROOM_TYPES_FOR_CLASS[classType] ?? []
    const autoRoom = g.preferredRoomId ?? allRooms.find(r => allowed.includes(r.type))?.id ?? ''
    setForm(f => ({ ...f, classType: classType as ClassType, curriculumEntryId: '', roomId: autoRoom }))
  }

  const DAY_NAMES = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'] as const
  const dayOfWeek = DAY_NAMES[new Date(date + 'T12:00:00').getDay()]

  const mutation = useMutation({
    mutationFn: async () => {
      if (scope === 'ONE') {
        return scheduleApi.createEntry({
          date,
          startTime: form.startTime,
          endTime: form.endTime,
          classType: form.classType as string,
          academicHours: Number(form.academicHours),
          roomId: form.roomId,
          instructorId: form.instructorId,
          curriculumEntryId: form.curriculumEntryId,
          studentGroupId: groupId || undefined,
          status: form.status,
        })
      }
      // Utwórz wzorzec tygodnia
      const tmpl = await scheduleApi.createTemplate({
        dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        classType: form.classType as string,
        academicHours: Number(form.academicHours),
        roomId: form.roomId,
        instructorId: form.instructorId,
        curriculumEntryId: form.curriculumEntryId,
        studentGroupId: groupId || undefined,
        semester: selectedGroup!.semester,
        academicYear,
        weekType: scope,
        studyMode,
      })
      // Jeśli jest kalendarz semestru — od razu generuj terminy
      if (calendarId) {
        await scheduleApi.generateSemester({ templateIds: [tmpl.data.data.id], calendarId })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      onSuccess(); onClose()
    },
    onError: (e: unknown) => {
      const data = (e as { response?: { data?: { error?: string; details?: Record<string, unknown> } } })?.response?.data
      setError(data?.error ? formatApiError(data.error, data.details) : 'Błąd zapisu — spróbuj ponownie')
    },
  })

  const canSubmit = !!form.curriculumEntryId && !!form.classType && !!form.roomId && !!form.instructorId && (scope === 'ONE' || !!selectedGroup)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Dodaj zajęcia — {new Date(date + 'T12:00:00').toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Godziny + status */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Od</Label>
              <Input type="time" value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Do</Label>
              <Input type="time" value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as 'MAKEUP' | 'SCHEDULED' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MAKEUP">Odrobienie</SelectItem>
                  <SelectItem value="SCHEDULED">Zaplanowane</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Kaskada filtrów */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Wydział</Label>
              <Select value={facultyId || '__all__'} onValueChange={v => { setFacultyId(v === '__all__' ? '' : v); setFieldId(''); setSpecId(''); setGroupId('') }}>
                <SelectTrigger><SelectValue placeholder="Wszystkie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Wszystkie</SelectItem>
                  {faculties.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Kierunek</Label>
              <Select value={fieldId || '__all__'} onValueChange={v => { setFieldId(v === '__all__' ? '' : v); setSpecId(''); setGroupId('') }}>
                <SelectTrigger><SelectValue placeholder="Wszystkie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Wszystkie</SelectItem>
                  {filteredFields.map(f => <SelectItem key={f.id} value={f.id}>{f.shortName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Specjalność</Label>
              <Select value={specId || '__all__'} onValueChange={v => { setSpecId(v === '__all__' ? '' : v); setGroupId('') }}>
                <SelectTrigger><SelectValue placeholder="Wszystkie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Wszystkie</SelectItem>
                  {filteredSpecs.map(s => <SelectItem key={s.id} value={s.id}>{s.shortName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Grupa <span className="text-destructive">*</span></Label>
              <Select value={groupId || '__none__'} onValueChange={v => handleGroupSelect(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Wybierz grupę" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— wybierz —</SelectItem>
                  {filteredGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Przedmiot + typ */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Przedmiot <span className="text-destructive">*</span></Label>
              <Select value={form.curriculumEntryId || '__none__'} onValueChange={v => setForm(f => ({ ...f, curriculumEntryId: v === '__none__' ? '' : v }))} disabled={!groupId}>
                <SelectTrigger><SelectValue placeholder="Wybierz przedmiot" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— wybierz —</SelectItem>
                  {curriculumEntries.map(e => <SelectItem key={e.id} value={e.id}>{e.subject.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Typ zajęć <span className="text-destructive">*</span></Label>
              <Select value={form.classType || '__none__'} onValueChange={v => setForm(f => ({ ...f, classType: v === '__none__' ? '' : v as ClassType }))}>
                <SelectTrigger><SelectValue placeholder="Typ" /></SelectTrigger>
                <SelectContent>
                  {availableClassTypes.map(t => <SelectItem key={t} value={t}>{CLASS_FULL_LABELS[t] ?? t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sala + prowadzący */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Sala <span className="text-destructive">*</span></Label>
              <Select value={form.roomId || '__none__'} onValueChange={v => setForm(f => ({ ...f, roomId: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz salę" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— wybierz —</SelectItem>
                  {filteredRooms.map(r => <SelectItem key={r.id} value={r.id}>{r.number} ({r.buildingName})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prowadzący <span className="text-destructive">*</span></Label>
              <Select value={form.instructorId || '__none__'} onValueChange={v => setForm(f => ({ ...f, instructorId: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz prowadzącego" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— wybierz —</SelectItem>
                  {instructors.map(i => <SelectItem key={i.id} value={i.id}>{i.title ? `${i.title} ` : ''}{i.firstName} {i.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Zakres powtarzania */}
          <div className="space-y-2 pt-1 border-t border-border">
            <Label className="text-xs text-muted-foreground">Zakres</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'ONE',   label: 'Tylko ten termin' },
                { value: 'EVERY', label: 'Każdy tydzień' },
                { value: 'EVEN',  label: 'Tygodnie parzyste' },
                { value: 'ODD',   label: 'Tygodnie nieparzyste' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setScope(opt.value)}
                  className={`text-xs rounded-md border px-3 py-2 text-left transition-colors ${
                    scope === opt.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted hover:bg-accent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {scope !== 'ONE' && !calendarId && (
              <p className="text-xs text-amber-500">Brak kalendarza semestru dla wybranego trybu — wzorzec zostanie utworzony, ale terminy nie zostaną wygenerowane automatycznie.</p>
            )}
            {scope !== 'ONE' && calendarId && (
              <p className="text-xs text-muted-foreground">Wzorzec zostanie dodany i terminy wygenerowane na cały semestr ({semesterType === 'WINTER' ? 'zimowy' : 'letni'} {academicYear}).</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? 'Dodawanie...' : 'Dodaj'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialog przenoszenia wpisu ────────────────────────────────

function MoveEntryDialog({
  entry,
  targetDate,
  targetStartTime,
  targetEndTime,
  onClose,
  onSuccess,
}: {
  entry: ScheduleEntry
  targetDate: string
  targetStartTime: string
  targetEndTime: string
  onClose: () => void
  onSuccess: () => void
}) {
  const qc = useQueryClient()
  const [scope, setScope] = useState<'ONE' | 'ALL'>('ONE')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => scheduleApi.moveEntry(entry.id, {
      newDate: targetDate,
      newStartTime: targetStartTime,
      newEndTime: targetEndTime,
      scope,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] })
      qc.invalidateQueries({ queryKey: ['templates'] })
      onSuccess()
      onClose()
    },
    onError: (e: unknown) => {
      const data = (e as { response?: { data?: { error?: string; details?: Record<string, unknown> } } })?.response?.data
      setError(data?.error ? formatApiError(data.error, data.details) : 'Błąd zapisu — spróbuj ponownie')
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Przenieś zajęcia</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          {error && <p className="text-destructive">{error}</p>}
          <p><span className="font-medium">Przedmiot:</span> {entry.curriculumEntry.subject.name}</p>
          <p><span className="font-medium">Nowy termin:</span> {new Date(targetDate).toLocaleDateString('pl-PL')} {targetStartTime}–{targetEndTime}</p>
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={scope === 'ONE'} onChange={() => setScope('ONE')} />
              <span>Tylko ten termin ({new Date(entry.date).toLocaleDateString('pl-PL')})</span>
            </label>
            {entry.templateId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={scope === 'ALL'} onChange={() => setScope('ALL')} />
                <span>Wszystkie przyszłe terminy z tego wzorca</span>
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Przenoszenie...' : 'Przenieś'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialog edycji wpisu ──────────────────────────────────────

function EditEntryDialog({
  entry,
  onClose,
  onSuccess,
}: {
  entry: ScheduleEntry
  onClose: () => void
  onSuccess: () => void
}) {
  const qc = useQueryClient()
  const [date, setDate] = useState(entry.date.slice(0, 10))
  const [startTime, setStartTime] = useState(entry.startTime)
  const [endTime, setEndTime] = useState(entry.endTime)
  const [roomId, setRoomId] = useState(entry.room.id)
  const [instructorId, setInstructorId] = useState(entry.instructor.id)
  const [error, setError] = useState('')

  const { data: buildingsData } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => buildingsApi.getAll(),
  })
  const { data: instructorsData } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.getAll(),
  })

  const allRooms = buildingsData?.data.data.flatMap(b => b.rooms.map(r => ({ ...r, buildingName: b.name }))) ?? []
  const instructors = instructorsData?.data.data ?? []

  const mutation = useMutation({
    mutationFn: () => scheduleApi.updateEntry(entry.id, { date, startTime, endTime, roomId, instructorId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] })
      onSuccess()
      onClose()
    },
    onError: (e: unknown) => {
      const data = (e as { response?: { data?: { error?: string; details?: Record<string, unknown> } } })?.response?.data
      setError(data?.error ? formatApiError(data.error, data.details) : 'Błąd zapisu — spróbuj ponownie')
    },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edytuj termin zajęć</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          {error && <p className="text-destructive text-sm">{error}</p>}
          <p className="font-medium">{entry.curriculumEntry.subject.name} · {CLASS_LABELS[entry.classType]}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Od</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Do</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Sala</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allRooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.number} ({r.type}, poj. {r.capacity}) – {r.buildingName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Prowadzący</Label>
              <Select value={instructorId} onValueChange={setInstructorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {instructors.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.title ? `${i.title} ` : ''}{i.firstName} {i.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Szczegóły wpisu ──────────────────────────────────────────

function EntryDetailPanel({
  entry,
  onClose,
}: {
  entry: ScheduleEntry
  onClose: () => void
}) {
  const [showEdit, setShowEdit] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const qc = useQueryClient()
  const cancelMutation = useMutation({
    mutationFn: () => scheduleApi.deleteEntry(entry.id, true),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entries'] }); onClose() },
  })

  const deleteMutation = useMutation({
    mutationFn: (scope: 'ONE' | 'ALL') =>
      scope === 'ALL' && entry.templateId
        ? scheduleApi.deleteEntries({ templateId: entry.templateId })
        : scheduleApi.deleteEntry(entry.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entries'] }); onClose() },
  })

  return (
    <>
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-xl p-6 w-80 space-y-3 border border-border"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{entry.curriculumEntry.subject.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p className="flex gap-2 items-center">
            <span className="font-medium text-foreground">Typ:</span>
            <Badge variant="secondary">{CLASS_LABELS[entry.classType]}</Badge>
          </p>
          <p><span className="font-medium text-foreground">Data:</span> {new Date(entry.date).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' })}</p>
          <p><span className="font-medium text-foreground">Czas:</span> {entry.startTime} – {entry.endTime}</p>
          <p><span className="font-medium text-foreground">Sala:</span> {entry.room.number} ({entry.room.building.name})</p>
          <p><span className="font-medium text-foreground">Prowadzący:</span> {entry.instructor.firstName} {entry.instructor.lastName}</p>
          {entry.studentGroup && (
            <p><span className="font-medium text-foreground">Grupa:</span> {entry.studentGroup.name}</p>
          )}
          <p>
            <span className="font-medium text-foreground">Status:</span>{' '}
            <span className={entry.status === 'CANCELLED' ? 'text-destructive' : entry.status === 'MAKEUP' ? 'text-amber-600' : 'text-green-600'}>
              {entry.status === 'CANCELLED' ? 'Odwołane' : entry.status === 'MAKEUP' ? 'Odrobienie' : 'Zaplanowane'}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowEdit(true)}
          >
            Edytuj
          </Button>
          {entry.status === 'SCHEDULED' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => { if (confirm('Odwołać te zajęcia? (zmieni status na Odwołane)')) cancelMutation.mutate() }}
              disabled={cancelMutation.isPending || deleteMutation.isPending}
            >
              Odwołaj zajęcia
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteMutation.isPending || cancelMutation.isPending}
          >
            {deleteMutation.isPending ? 'Usuwanie...' : 'Usuń termin'}
          </Button>
        </div>
      </div>
    </div>

    {showDeleteConfirm && (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center" onClick={() => setShowDeleteConfirm(false)}>
        <div
          className="bg-card rounded-xl shadow-xl p-6 w-80 space-y-4 border border-border"
          onClick={e => e.stopPropagation()}
        >
          <h3 className="font-semibold text-base">Usuń zajęcia</h3>
          <p className="text-sm text-muted-foreground">
            Czy usunąć tylko ten termin ({new Date(entry.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}), czy wszystkie terminy z tego wzorca w całym semestrze?
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => { setShowDeleteConfirm(false); deleteMutation.mutate('ONE') }}
            >
              Tylko ten termin
            </Button>
            {entry.templateId && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => { setShowDeleteConfirm(false); deleteMutation.mutate('ALL') }}
              >
                Wszystkie terminy (cały semestr)
              </Button>
            )}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowDeleteConfirm(false)}>
              Anuluj
            </Button>
          </div>
        </div>
      </div>
    )}

    {showEdit && (
      <EditEntryDialog
        entry={entry}
        onClose={() => setShowEdit(false)}
        onSuccess={onClose}
      />
    )}
    </>
  )
}

// ─── Dialog auto-generowania wzorca ──────────────────────────

type TemplateProposal = {
  specializationId?: string
  specializationName?: string
  curriculumEntryId: string
  subjectName: string
  classType: ClassType
  academicHours: number
  dayOfWeek?: DayOfWeek
  startTime?: string
  endTime?: string
  roomId?: string
  roomNumber?: string
  buildingName?: string
  instructorId?: string | null
  instructorName?: string | null
  studentGroupId?: string | null
  studentGroupName?: string | null
  semester: number
  academicYear: string
  studyMode: StudyMode
  weekType?: string
  warning?: string          // no slot found — proposal is unselectable
  note?: string             // slot found but with a caveat (e.g. room smaller than group)
  alreadyScheduled?: boolean // entry+classType already has a template — pre-deselected by default
}

function AutoGenerateDialog({
  open, onClose, semester, semesterType, academicYear, studyMode, facultyId, fieldOfStudyId, specializationId,
}: {
  open: boolean
  onClose: () => void
  semester?: number
  semesterType: 'WINTER' | 'SUMMER'
  academicYear: string
  studyMode?: StudyMode
  facultyId?: string
  fieldOfStudyId?: string
  specializationId?: string
}) {
  const [proposals, setProposals] = useState<TemplateProposal[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [step, setStep] = useState<'confirm' | 'preview'>('confirm')

  const qc = useQueryClient()

  const generateMutation = useMutation({
    mutationFn: () => scheduleApi.generateTemplate({
      facultyId: facultyId || undefined,
      fieldOfStudyId: fieldOfStudyId || undefined,
      specializationId: specializationId || undefined,
      semester: semester || undefined,
      semesterType,
      academicYear,
      studyMode: studyMode || undefined,
    }),
    onSuccess: (res) => {
      const data = res.data.data as TemplateProposal[]
      setProposals(data)
      setSelected(new Set(
        data.map((p, i) => (!p.warning && !p.alreadyScheduled) ? i : -1).filter(i => i >= 0)
      ))
      setStep('preview')
    },
  })

  const [savedCount, setSavedCount] = useState(0)
  const [skippedNoInstructor, setSkippedNoInstructor] = useState(0)

  const [saveFailures, setSaveFailures] = useState<string[]>([])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const toSave = proposals.filter((p, i) => selected.has(i) && !p.warning)
      let saved = 0
      let skipped = 0
      const failures: string[] = []
      for (const p of toSave) {
        if (!p.instructorId) { skipped++; continue }
        try {
          await scheduleApi.createTemplate({
            curriculumEntryId: p.curriculumEntryId,
            classType: p.classType,
            academicHours: p.academicHours,
            roomId: p.roomId!,
            instructorId: p.instructorId,
            dayOfWeek: p.dayOfWeek!,
            startTime: p.startTime!,
            endTime: p.endTime!,
            semester: p.semester,
            academicYear: p.academicYear,
            weekType: p.weekType ?? 'EVERY',
            studyMode: p.studyMode,
            studentGroupId: p.studentGroupId ?? undefined,
          })
          saved++
        } catch (err: unknown) {
          const errData = (err as { response?: { data?: { error?: string; details?: Record<string, unknown> } } })?.response?.data
          const errMsg = errData?.error ? formatApiError(errData.error, errData.details) : 'Błąd zapisu'
          const dayLabel = p.dayOfWeek ? (DAY_SHORT[p.dayOfWeek] ?? p.dayOfWeek) : ''
          failures.push(`${p.subjectName} (${CLASS_FULL_LABELS[p.classType] ?? p.classType}) ${dayLabel} ${p.startTime} — ${errMsg}`)
        }
      }
      setSavedCount(saved)
      setSkippedNoInstructor(skipped)
      setSaveFailures(failures)
      // Zawsze odśwież dane — nawet przy częściowym sukcesie
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['templates-all'] })
      if (failures.length === 0 && skipped === 0) handleClose()
    },
  })

  function handleClose() {
    setStep('confirm')
    setProposals([])
    setSelected(new Set())
    setSavedCount(0)
    setSkippedNoInstructor(0)
    setSaveFailures([])
    saveMutation.reset()
    onClose()
  }

  // valid = slot znaleziony (brak warning) i nie jest już zaplanowane
  const newIndices  = proposals.map((p, i) => (!p.warning && !p.alreadyScheduled) ? i : -1).filter(i => i >= 0)
  const [showAlreadyScheduled, setShowAlreadyScheduled] = useState(false)

  function toggleAll() {
    setSelected(selected.size === newIndices.length ? new Set() : new Set(newIndices))
  }

  const DAY_LABELS: Partial<Record<DayOfWeek, string>> = {
    MONDAY: 'Pon', TUESDAY: 'Wt', WEDNESDAY: 'Śr', THURSDAY: 'Czw',
    FRIDAY: 'Pt', SATURDAY: 'Sb', SUNDAY: 'Nd',
  }

  const newProposals = proposals.filter(p => !p.alreadyScheduled)
  const alreadyScheduledProposals = proposals.filter(p => p.alreadyScheduled)

  function renderProposalRow(p: TemplateProposal, i: number) {
    const hasSlot = !p.warning
    const hasInstructor = !!p.instructorId
    return (
      <div key={i} className={`flex items-start gap-3 px-3 py-2 ${!hasSlot ? 'opacity-50 bg-muted/30' : ''}`}>
        <input
          type="checkbox"
          className="mt-0.5 cursor-pointer"
          checked={selected.has(i)}
          disabled={!hasSlot}
          onChange={() => setSelected(prev => {
            const next = new Set(prev)
            next.has(i) ? next.delete(i) : next.add(i)
            return next
          })}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{p.subjectName}</span>
            <Badge variant="outline" className="text-[10px]">{CLASS_LABELS[p.classType]}</Badge>
            <span className="text-xs text-muted-foreground">{p.academicHours}h</span>
            {p.specializationName && (
              <Badge variant="secondary" className="text-[10px]">{p.specializationName}</Badge>
            )}
          </div>
          {hasSlot ? (
            <div className="text-xs text-muted-foreground mt-0.5">
              {DAY_LABELS[p.dayOfWeek!]} {p.startTime}–{p.endTime} · sala {p.roomNumber} ({p.buildingName})
              {p.instructorName && <span> · {p.instructorName}</span>}
              {p.studentGroupName && <span> · gr. {p.studentGroupName}</span>}
              {(!semester || !studyMode) && (
                <span className="ml-1">
                  {!semester && <span>· sem. {p.semester}</span>}
                  {!studyMode && <span className="ml-1">· {p.studyMode === 'FULL_TIME' ? 'St.' : 'Nst.'}</span>}
                </span>
              )}
              {!hasInstructor && (
                <span className="block text-yellow-600 dark:text-yellow-400 mt-0.5">Brak prowadzącego — wpis zostanie pominięty przy zapisie</span>
              )}
              {p.note && (
                <span className="block text-yellow-600 dark:text-yellow-400 mt-0.5">{p.note}</span>
              )}
            </div>
          ) : (
            <div className="text-xs text-destructive mt-0.5">{p.warning}</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Auto-generuj wzorzec tygodnia</DialogTitle>
        </DialogHeader>

        {step === 'confirm' && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Generator dobierze wolne sloty czasowe, sale i prowadzących na podstawie siatki godzin.
            </p>
            <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
              <div><span className="text-muted-foreground">Semestr:</span> <strong>{semester ?? `${semesterType === 'WINTER' ? 'zimowe' : 'letnie'} (${SEMESTER_TYPE_NUMBERS[semesterType].join(', ')})`}</strong></div>
              <div><span className="text-muted-foreground">Rok akademicki:</span> <strong>{academicYear}</strong></div>
              <div>
                <span className="text-muted-foreground">Tryb: </span>
                <strong>{studyMode ? (studyMode === 'FULL_TIME' ? 'stacjonarne' : 'niestacjonarne') : <span className="text-muted-foreground italic">wszystkie</span>}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Zakres: </span>
                <strong>
                  {specializationId ? 'wybrana specjalność'
                    : fieldOfStudyId ? 'wszystkie specjalności kierunku'
                    : facultyId ? 'wszystkie specjalności wydziału'
                    : <span className="text-destructive">wybierz co najmniej wydział</span>}
                </strong>
              </div>
            </div>
            {generateMutation.isError && (
              <p className="text-sm text-destructive">
                {(generateMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd generowania — brak grup lub siatki godzin'}
              </p>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {newProposals.length} nowych propozycji · {selected.size} zaznaczonych
              </p>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {selected.size === newIndices.length && newIndices.length > 0 ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
              </Button>
            </div>

            <div className="border rounded-md divide-y text-sm">
              {newProposals.map((p) => renderProposalRow(p, proposals.indexOf(p)))}
              {newProposals.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Wszystkie zajęcia z siatki są już zaplanowane.
                </p>
              )}
            </div>

            {alreadyScheduledProposals.length > 0 && (
              <div>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 py-1"
                  onClick={() => setShowAlreadyScheduled(v => !v)}
                >
                  <ChevronDown className={`h-3 w-3 transition-transform ${showAlreadyScheduled ? 'rotate-180' : ''}`} />
                  Już w planie ({alreadyScheduledProposals.length}) — pokaż alternatywne sloty
                </button>
                {showAlreadyScheduled && (
                  <div className="border rounded-md divide-y text-sm opacity-60">
                    {alreadyScheduledProposals.map((p) => renderProposalRow(p, proposals.indexOf(p)))}
                  </div>
                )}
              </div>
            )}


            {saveMutation.isSuccess && savedCount > 0 && saveFailures.length === 0 && skippedNoInstructor === 0 && (
              <p className="text-sm text-green-600">Zapisano {savedCount} wzorców.</p>
            )}
            {skippedNoInstructor > 0 && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Pominięto {skippedNoInstructor} wpisów bez prowadzącego.
              </p>
            )}
            {saveFailures.length > 0 && (
              <div className="text-sm space-y-0.5">
                <p className="font-medium text-yellow-600 dark:text-yellow-400">
                  Zapisano {savedCount} wzorców, nie zapisano {saveFailures.length} (konflikty):
                </p>
                <div className="max-h-40 overflow-y-auto rounded border border-yellow-500/30 bg-yellow-500/5 px-2 py-1 space-y-0.5">
                  {saveFailures.map((f, i) => <p key={i} className="text-xs text-muted-foreground">{f}</p>)}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'confirm' ? (
            <>
              <Button variant="ghost" onClick={handleClose}>Anuluj</Button>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={(!facultyId && !fieldOfStudyId && !specializationId) || generateMutation.isPending}
              >
                {generateMutation.isPending ? 'Generowanie...' : 'Generuj propozycje'}
              </Button>
            </>
          ) : (
            <>
              {!saveMutation.isSuccess && saveFailures.length === 0 && (
                <Button variant="ghost" onClick={() => setStep('confirm')}>← Wróć</Button>
              )}
              {saveMutation.isSuccess || saveFailures.length > 0 ? (
                <Button onClick={handleClose}>Zamknij</Button>
              ) : (
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={selected.size === 0 || saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Zapisywanie...' : `Zatwierdź zaznaczone (${selected.size})`}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Helper: pozycje co 30 min bez konfliktu → ghost bloki ─────

function getValidSlots(
  occupied: Array<{ start: number; end: number }>,
  blockMins: number,
  checkMins = blockMins,
  windowFrom = START_MINS,
): Array<{ top: number; height: number }> {
  const slots: Array<{ top: number; height: number }> = []
  for (let s = Math.max(START_MINS, windowFrom); s + blockMins <= END_HOUR * 60; s += 30) {
    if (!occupied.some(o => o.start < s + checkMins && o.end > s)) {
      slots.push({
        top: (s - START_MINS) / SLOT_MINS * SLOT_HEIGHT,
        height: blockMins / SLOT_MINS * SLOT_HEIGHT - 2,
      })
    }
  }
  return slots
}

/** Minimalna liczba minut od północy dla początku slotu w danym dniu (PART_TIME).
 *  Zwraca null gdy dzień jest w ogóle niedozwolony. */
function partTimeWindowFrom(dayKey: string): number | null {
  switch (dayKey) {
    case 'FRIDAY':   return 15 * 60   // Pt 15:00–20:00
    case 'SATURDAY':
    case 'SUNDAY':   return 7 * 60    // Sb/Nd 07:00–20:00
    default:         return null      // Pn–Czw — niedozwolone
  }
}

// ─── Picker grup z checkboxami ─────────────────────────────────

function GroupCheckboxPicker({
  groups,
  selected,
  onChange,
  disabled,
  triggerClassName,
}: {
  groups: { id: string; name: string }[]
  selected: Set<string> | null
  onChange: (next: Set<string> | null) => void
  disabled?: boolean
  triggerClassName?: string
}) {
  // null = brak filtra (wszystkie), Set = jawny wybór (pusty = żadna)
  const allSelected = selected === null

  const toggle = (id: string) => {
    if (allSelected) {
      onChange(new Set(groups.map(g => g.id).filter(gid => gid !== id)))
    } else {
      const next = new Set(selected)
      if (next.has(id)) {
        next.delete(id)
        onChange(next)
      } else {
        next.add(id)
        onChange(next)
      }
    }
  }

  const label = allSelected
    ? 'Wszystkie grupy'
    : selected.size === 0
      ? 'Brak grup'
      : selected.size === 1
        ? (groups.find(g => g.id === [...selected][0])?.name ?? '1 grupa')
        : `${selected.size} grup`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`border-input flex items-center justify-between gap-2 rounded-md border bg-transparent px-3 shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50 h-8 text-xs text-left whitespace-nowrap ${triggerClassName ?? 'w-full'}`}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        {groups.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1">Brak grup</p>
        ) : (
          <>
            <button
              type="button"
              className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors mb-1"
              onClick={() => onChange(allSelected ? new Set() : null)}
            >
              {allSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
            </button>
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {groups.map(g => (
                <label
                  key={g.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={allSelected || (selected !== null && selected.has(g.id))}
                    onCheckedChange={() => toggle(g.id)}
                  />
                  <span className="text-xs">{g.name}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

// EVEN+ODD nie kolidują; wszystkie inne kombinacje kolidują
function weekTypesConflict(a: string, b: string): boolean {
  return !(( a === 'EVEN' && b === 'ODD') || (a === 'ODD' && b === 'EVEN'))
}

// ─── Zakładka Wzorzec tygodnia ─────────────────────────────────

function TemplateTab({ academicYear }: { academicYear: string }) {
  const { semesterType } = useAcademicYearStore()
  const availableSemesters = SEMESTER_TYPE_NUMBERS[semesterType]

  // ── Sekcja 1: filtry API (co ładujemy) ──────────────────────
  const [facultyId, setFacultyId] = useState('')
  const [fieldOfStudyId, setFieldOfStudyId] = useState('')
  const [specializationId, setSpecializationId] = useState('')
  const [semester, setSemester] = useState('')
  const [studyMode, setStudyMode] = useState('')

  // ── Sekcja 2: filtry widoku (client-side) ────────────────────
  const [filterGroupIds, setFilterGroupIds] = useState<Set<string> | null>(null)
  const [filterInstructorId, setFilterInstructorId] = useState('')
  const [filterClassType, setFilterClassType] = useState('')
  const [filterRoomId, setFilterRoomId] = useState('')

  // Reset filtrów widoku gdy zmienią się górne filtry zakresu
  useEffect(() => {
    setFilterInstructorId('')
    setFilterClassType('')
    setFilterRoomId('')
    setFilterGroupIds(null)
  }, [facultyId, fieldOfStudyId, specializationId, semester, studyMode])

  const displayStudyMode: StudyMode = (studyMode as StudyMode) || 'FULL_TIME'
  const days = !studyMode
    ? [...DAYS_FULL, { key: 'SATURDAY' as DayOfWeek, label: 'Sobota' }, { key: 'SUNDAY' as DayOfWeek, label: 'Niedziela' }]
    : studyMode === 'PART_TIME' ? DAYS_PART : DAYS_FULL

  const [addSlot, setAddSlot] = useState<{ dayOfWeek: string; startTime: string } | null>(null)
  const [editTemplate, setEditTemplate] = useState<ScheduleTemplate | null>(null)
  const [showGenerateSemester, setShowGenerateSemester] = useState(false)
  const [showAutoGenerate, setShowAutoGenerate] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overSlot, setOverSlot] = useState<string | null>(null)

  // ── Zapytania dla sekcji 1 ───────────────────────────────────
  const { data: facultiesData } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => facultiesApi.getAll(),
  })
  const { data: fieldsData } = useQuery({
    queryKey: ['fields-of-study', facultyId],
    queryFn: () => fieldsApi.getAll(facultyId || undefined),
    enabled: !!studyMode,
  })
  const { data: specsData } = useQuery({
    queryKey: ['specializations', fieldOfStudyId],
    queryFn: () => specsApi.getAll(fieldOfStudyId),
    enabled: !!fieldOfStudyId,
  })
  const { data: groupsData } = useQuery({
    queryKey: ['groups-tmpl', academicYear, fieldOfStudyId, specializationId, semester],
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

  const semesterNum = semester ? parseInt(semester) : undefined
  const studyModeVal = (studyMode as StudyMode) || undefined

  const { data, refetch } = useQuery({
    queryKey: ['templates', semesterNum, academicYear, semesterType, studyModeVal],
    queryFn: () => scheduleApi.getTemplates({ semester: semesterNum, semesterType: semesterNum ? undefined : semesterType, academicYear, studyMode: studyModeVal }),
  })

  // Wszystkie szablony danego roku — do sprawdzania kolizji (bez filtrów semestru/trybu)
  const { data: allTemplatesData } = useQuery({
    queryKey: ['templates-all', academicYear, semesterType],
    queryFn: () => scheduleApi.getTemplates({ academicYear, semesterType }),
  })

  const templates = data?.data.data ?? []
  const allTemplates = allTemplatesData?.data.data ?? []

  // Unikalne prowadzący i sale z załadowanych wzorców (bez dodatkowych zapytań)
  const tmplInstructors = useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{ id: string; firstName: string; lastName: string; title?: string | null }> = []
    for (const t of templates) {
      if (!seen.has(t.instructor.id)) {
        seen.add(t.instructor.id)
        result.push(t.instructor)
      }
    }
    return result.sort((a, b) => a.lastName.localeCompare(b.lastName))
  }, [templates])

  const tmplRooms = useMemo(() => {
    const seen = new Set<string>()
    const result: Array<{ id: string; number: string; building: { name: string } }> = []
    for (const t of templates) {
      if (!seen.has(t.room.id)) {
        seen.add(t.room.id)
        result.push(t.room)
      }
    }
    return result.sort((a, b) => a.number.localeCompare(b.number))
  }, [templates])

  // Zestaw ID grup dla wybranego kierunku/specjalności (do filtrowania widoku)
  const groupIdSet = useMemo(
    () => fieldOfStudyId ? new Set(groups.map(g => g.id)) : null,
    [fieldOfStudyId, groups]
  )

  // Wzorce do wyświetlenia (filtry widoku) vs. wszystkie (do kolizji)
  const visibleTemplates = useMemo(() =>
    templates.filter(t =>
      (!groupIdSet || !t.studentGroup || groupIdSet.has(t.studentGroup.id)) &&
      (filterGroupIds === null || (t.studentGroup ? filterGroupIds.has(t.studentGroup.id) : false)) &&
      (!filterInstructorId || t.instructor.id === filterInstructorId) &&
      (!filterClassType || t.classType === filterClassType) &&
      (!filterRoomId || t.room.id === filterRoomId)
    ),
    [templates, filterGroupIds, filterInstructorId, filterClassType, filterRoomId, groupIdSet]
  )

  const byDay = useMemo(() => {
    const map: Record<string, ScheduleTemplate[]> = {}
    for (const d of days) map[d.key] = []
    for (const t of templates) {
      if (map[t.dayOfWeek]) map[t.dayOfWeek]!.push(t)
    }
    return map
  }, [templates, days])

  // allByDay: wszystkie szablony roku (do walidacji kolizji, niezależnie od filtrów)
  const allByDay = useMemo(() => {
    const map: Record<string, ScheduleTemplate[]> = {}
    for (const d of [...DAYS_FULL, ...DAYS_PART]) map[d.key] = []
    for (const t of allTemplates) {
      if (map[t.dayOfWeek]) map[t.dayOfWeek]!.push(t)
    }
    return map
  }, [allTemplates])

  const visibleByDay = useMemo(() => {
    const map: Record<string, ScheduleTemplate[]> = {}
    for (const d of days) map[d.key] = []
    for (const t of visibleTemplates) {
      if (map[t.dayOfWeek]) map[t.dayOfWeek]!.push(t)
    }
    return map
  }, [visibleTemplates, days])

  const activeTemplate = activeId ? templates.find(t => t.id === activeId) : null

  const dragInfo = useMemo(() => {
    if (!activeTemplate) return null
    const durationMins = timeToMins(activeTemplate.endTime) - timeToMins(activeTemplate.startTime)
    const blockMins = durationMins
    const result: Record<string, Array<{ top: number; height: number }>> = {}
    for (const day of days) {
      // Dla PART_TIME pomiń całkowicie dni poza oknem
      if (activeTemplate.studyMode === 'PART_TIME') {
        const windowFrom = partTimeWindowFrom(day.key)
        if (windowFrom === null) { result[day.key] = []; continue }
        const occupied = (allByDay[day.key] ?? [])
          .filter(t =>
            t.id !== activeTemplate.id &&
            weekTypesConflict(activeTemplate.weekType, t.weekType) && (
              t.room.id === activeTemplate.room.id ||
              t.instructor.id === activeTemplate.instructor.id ||
              (t.studentGroup?.id && t.studentGroup.id === activeTemplate.studentGroup?.id)
            )
          )
          .map(t => ({ start: timeToMins(t.startTime), end: timeToMins(t.endTime) }))
        result[day.key] = getValidSlots(occupied, blockMins, durationMins, windowFrom)
        continue
      }
      const occupied = (allByDay[day.key] ?? [])
        .filter(t =>
          t.id !== activeTemplate.id &&
          weekTypesConflict(activeTemplate.weekType, t.weekType) && (
            t.room.id === activeTemplate.room.id ||
            t.instructor.id === activeTemplate.instructor.id ||
            (t.studentGroup?.id && t.studentGroup.id === activeTemplate.studentGroup?.id)
          )
        )
        .map(t => ({ start: timeToMins(t.startTime), end: timeToMins(t.endTime) }))
      result[day.key] = getValidSlots(occupied, blockMins, durationMins)
    }
    return result
  }, [activeTemplate, allByDay, days])

  const hoverGhostTemplate = useMemo(() => {
    if (!activeTemplate || !overSlot) return null
    const [dayKey, slotTime] = overSlot.split('::')
    if (!dayKey || !slotTime) return null
    const startMins = timeToMins(slotTime)
    const durationMins = timeToMins(activeTemplate.endTime) - timeToMins(activeTemplate.startTime)
    const blockMins = durationMins
    if (startMins + blockMins > END_HOUR * 60) return null
    const proposedEnd = startMins + durationMins
    const others = (allByDay[dayKey] ?? []).filter(t =>
      t.id !== activeTemplate.id &&
      weekTypesConflict(activeTemplate.weekType, t.weekType) && (
        t.room.id === activeTemplate.room.id ||
        t.instructor.id === activeTemplate.instructor.id ||
        (t.studentGroup?.id && t.studentGroup.id === activeTemplate.studentGroup?.id)
      )
    )
    const conflicts = others.filter(t => {
      const s = timeToMins(t.startTime), e = timeToMins(t.endTime)
      return s < proposedEnd && e > startMins
    })
    // Sprawdź okno czasowe dla PART_TIME
    let timeWindowOk = true
    if (activeTemplate.studyMode === 'PART_TIME') {
      const windowFrom = partTimeWindowFrom(dayKey)
      timeWindowOk = windowFrom !== null && startMins >= windowFrom && proposedEnd <= END_HOUR * 60
    }
    const timeWindowViolation = !timeWindowOk
    const valid = conflicts.length === 0 && timeWindowOk
    return { dayKey, startMins, blockMins, valid, conflicts, timeWindowViolation }
  }, [activeTemplate, overSlot, allByDay])

  const qc = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: ({ id, dayOfWeek, startTime, endTime }: { id: string; dayOfWeek: string; startTime: string; endTime: string }) =>
      scheduleApi.updateTemplate(id, { dayOfWeek, startTime, endTime }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['templates-all'] })
    },
    onError: (err: unknown) => {
      qc.invalidateQueries({ queryKey: ['templates-all'] })
      const data = (err as { response?: { data?: { error?: string; details?: Record<string, unknown> } } })?.response?.data
      toast.error(data?.error ? formatApiError(data.error, data.details) : 'Nie udało się przenieść zajęć')
    },
  })

  const deleteManyMutation = useMutation({
    mutationFn: () => scheduleApi.deleteTemplates({ semester: semesterNum, academicYear, studyMode: studyModeVal }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      qc.invalidateQueries({ queryKey: ['templates-all'] })
    },
  })

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

    const tpl = templates.find(t => t.id === active.id)
    if (!tpl) return

    const startMins = timeToMins(slotTime)
    const durationMins = timeToMins(tpl.endTime) - timeToMins(tpl.startTime)
    const endMins = startMins + durationMins
    const newStart = minsToTime(startMins)
    const newEnd = minsToTime(endMins)

    if (tpl.dayOfWeek === day && tpl.startTime === newStart) return

    // Blokuj upuszczenie poza oknem czasowym PART_TIME
    if (tpl.studyMode === 'PART_TIME') {
      const windowFrom = partTimeWindowFrom(day)
      if (windowFrom === null || startMins < windowFrom || endMins > END_HOUR * 60) return
    }

    const others = (allByDay[day] ?? []).filter(t =>
      t.id !== tpl.id &&
      weekTypesConflict(tpl.weekType, t.weekType) && (
        t.room.id === tpl.room.id ||
        t.instructor.id === tpl.instructor.id ||
        (t.studentGroup?.id && t.studentGroup.id === tpl.studentGroup?.id)
      )
    )
    const hasConflict = others.some(t => {
      const s = timeToMins(t.startTime), e2 = timeToMins(t.endTime)
      return s < endMins && e2 > startMins
    })
    if (hasConflict) return

    updateMutation.mutate({ id: tpl.id, dayOfWeek: day, startTime: newStart, endTime: newEnd })
  }

  const totalSlotsHeight = SLOTS.length * SLOT_HEIGHT

  return (
    <div>
      {/* ── Sekcja 1: Zakres generowania planu ─────────────── */}
      <div className="p-3 mb-2 bg-card rounded-lg border border-border">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Zakres generowania planu i widok</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Wydział</label>
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
            <label className="text-[11px] text-muted-foreground">Tryb</label>
            <Select value={studyMode || '__all__'} onValueChange={v => {
              setStudyMode(v === '__all__' ? '' : v)
              setFieldOfStudyId(''); setSpecializationId(''); setSemester(''); setFilterGroupIds(null)
            }} disabled={!facultyId}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie tryby</SelectItem>
                <SelectItem value="FULL_TIME">Stacjonarne</SelectItem>
                <SelectItem value="PART_TIME">Niestacjonarne</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Kierunek</label>
            <Select value={fieldOfStudyId || '__all__'} onValueChange={v => {
              const val = v === '__all__' ? '' : v
              setFieldOfStudyId(val); setSpecializationId(''); setSemester(''); setFilterGroupIds(null)
            }} disabled={!studyMode}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie kierunki</SelectItem>
                {fields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Specjalność</label>
            <Select value={specializationId || '__all__'} onValueChange={v => {
              const val = v === '__all__' ? '' : v
              setSpecializationId(val); setFilterGroupIds(null)
            }} disabled={!fieldOfStudyId}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie specjalności</SelectItem>
                {specs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Semestr</label>
            <Select value={semester || '__all__'} onValueChange={v => setSemester(v === '__all__' ? '' : v)} disabled={!specializationId}>
              <SelectTrigger className="w-full h-8 text-xs">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie semestry</SelectItem>
                {availableSemesters.map(s => (
                  <SelectItem key={s} value={String(s)}>Sem. {s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">
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
          <Button variant="default" size="sm" onClick={() => setShowAutoGenerate(true)} disabled={!facultyId}>
            Auto-generuj
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowGenerateSemester(true)} disabled={templates.length === 0}>
            Generuj terminy ({visibleTemplates.length})
          </Button>
          <Button
            variant="destructive" size="sm"
            disabled={deleteManyMutation.isPending || templates.length === 0}
            onClick={() => {
              if (confirm(`Usunąć wzorce dla ${semesterNum ? `sem. ${semesterNum}` : 'wszystkich semestrów'} (${academicYear})?`)) {
                deleteManyMutation.mutate()
              }
            }}
          >
            {deleteManyMutation.isPending ? 'Usuwanie...' : `Wyczyść wzorzec (${templates.length})`}
          </Button>
        </div>
      </div>

      {/* ── Sekcja 2: Widok (filtry client-side) ──────────── */}
      <div className="p-3 mb-3 bg-card rounded-lg border border-border">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Widok</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Typ zajęć</label>
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
            <label className="text-[11px] text-muted-foreground">Prowadzący</label>
            <Select value={filterInstructorId || '__all__'} onValueChange={v => setFilterInstructorId(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Wszyscy" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszyscy prowadzący</SelectItem>
                {tmplInstructors.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.title ? `${i.title} ` : ''}{i.firstName} {i.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Sala</label>
            <Select value={filterRoomId || '__all__'} onValueChange={v => setFilterRoomId(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Wszystkie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Wszystkie sale</SelectItem>
                {tmplRooms.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.number} ({r.building.name})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(filterClassType || filterInstructorId || filterRoomId) && (
            <div className="flex flex-col justify-end gap-1">
              <label className="text-[11px] text-transparent select-none">_</label>
              <Button variant="outline" size="sm" className="h-8 text-xs px-3"
                onClick={() => { setFilterClassType(''); setFilterInstructorId(''); setFilterRoomId('') }}>
                Wyczyść · {visibleTemplates.length}/{templates.length}
              </Button>
            </div>
          )}
        </div>
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
            {days.map((day) => (
              <div key={day.key} className="flex-1 border-r border-border last:border-r-0">
                <div className="h-10 border-b border-border flex items-center justify-center text-sm font-medium">
                  {day.label}
                </div>
                <div style={{ height: totalSlotsHeight }} className="relative">
                  {SLOTS.map((slot, i) => (
                    <DroppableSlot
                      key={slot}
                      id={`${day.key}::${slot}`}
                      top={i * SLOT_HEIGHT}
                    >
                      <div
                        onClick={() => !activeId && setAddSlot({ dayOfWeek: day.key, startTime: slot })}
                        className={`w-full h-full border-t cursor-pointer hover:bg-primary/5 transition-colors ${
                          i === 0 ? 'border-transparent' :
                          slot.endsWith(':00') ? 'border-border' :
                          slot.endsWith(':30') ? 'border-border/50' :
                          'border-border/20'
                        }`}
                      />
                    </DroppableSlot>
                  ))}
                  {/* Ghost bloki valid pozycji podczas przeciągania */}
                  {dragInfo?.[day.key]?.map(({ top, height }, i) => (
                    <div key={`v${i}`} style={{ position: 'absolute', top, height, left: 3, right: 3, zIndex: 0 }}
                      className="rounded border border-dashed border-green-500/50 pointer-events-none" />
                  ))}
                  {/* Ghost blok na aktualnej pozycji kursora */}
                  {hoverGhostTemplate?.dayKey === day.key && (
                    <>
                      <div style={{
                        position: 'absolute',
                        top: (hoverGhostTemplate.startMins - START_MINS) / SLOT_MINS * SLOT_HEIGHT,
                        height: hoverGhostTemplate.blockMins / SLOT_MINS * SLOT_HEIGHT - 2,
                        left: 4, right: 4, zIndex: 5,
                      }}
                        className={`rounded border-2 pointer-events-none ${
                          hoverGhostTemplate.valid
                            ? 'bg-green-500/30 border-green-400'
                            : 'bg-red-500/25 border-red-400'
                        }`}
                      />
                      {!hoverGhostTemplate.valid && (
                        <div style={{
                          position: 'absolute',
                          top: (hoverGhostTemplate.startMins - START_MINS) / SLOT_MINS * SLOT_HEIGHT,
                          left: 4, right: 4, zIndex: 6,
                        }}
                          className="pointer-events-none bg-red-950/95 rounded border border-red-500 px-1.5 py-1"
                        >
                          {hoverGhostTemplate.timeWindowViolation ? (
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
                          ) : hoverGhostTemplate.conflicts.length > 0 && (
                            <>
                              <p className="text-[10px] font-bold text-red-300 uppercase tracking-wide mb-1">
                                Kolizja ({hoverGhostTemplate.conflicts.length})
                              </p>
                              {hoverGhostTemplate.conflicts.map((t, i) => {
                                const reasons = [
                                  t.room.id === activeTemplate!.room.id && `sala ${t.room.number}`,
                                  t.instructor.id === activeTemplate!.instructor.id && `${t.instructor.title ? t.instructor.title + ' ' : ''}${t.instructor.lastName}`,
                                  t.studentGroup?.id && t.studentGroup.id === activeTemplate!.studentGroup?.id && `gr. ${t.studentGroup.name}`,
                                ].filter(Boolean).join(', ')
                                return (
                                  <div key={i} className="mb-1 last:mb-0 border-l-2 border-red-400 pl-1.5">
                                    <p className="text-[10px] font-semibold text-red-100 leading-tight">
                                      {t.curriculumEntry.subject.name}
                                    </p>
                                    <p className="text-[9px] text-red-300 leading-tight">
                                      {t.startTime}–{t.endTime}
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
                  {visibleByDay[day.key]?.map(t => (
                    <DraggableTemplateBlock
                      key={t.id}
                      template={t}
                      onClick={() => setEditTemplate(t)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeTemplate && (
            <div
              style={{ height: (timeToMins(activeTemplate.endTime) - timeToMins(activeTemplate.startTime)) / SLOT_MINS * SLOT_HEIGHT - 2 }}
              className={`rounded border-l-4 px-2 py-1 text-xs shadow-xl w-32 ${CLASS_COLORS[activeTemplate.classType]}`}
            >
              <p className="font-semibold truncate">{activeTemplate.curriculumEntry.subject.name}</p>
              <p className="truncate opacity-70">{CLASS_LABELS[activeTemplate.classType]} · {activeTemplate.room.number}</p>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <p className="text-xs text-muted-foreground mt-2">
        Kliknij na pustą komórkę aby dodać zajęcia. Przeciągnij blok aby zmienić czas/dzień.
      </p>

      {addSlot && (
        <AddTemplateDialog
          open
          prefill={addSlot}
          semester={semesterNum ?? 1}
          academicYear={academicYear}
          studyMode={displayStudyMode}
          onClose={() => setAddSlot(null)}
          onSuccess={() => void refetch()}
        />
      )}

      {editTemplate && (
        <EditTemplateDialog
          template={editTemplate}
          onClose={() => setEditTemplate(null)}
          onSuccess={() => void refetch()}
        />
      )}

      {showGenerateSemester && (
        <GenerateSemesterDialog
          open
          templates={visibleTemplates}
          academicYear={academicYear}
          semesterType={semesterType}
          onClose={() => setShowGenerateSemester(false)}
        />
      )}

      <AutoGenerateDialog
        open={showAutoGenerate}
        onClose={() => setShowAutoGenerate(false)}
        semester={semesterNum}
        semesterType={semesterType}
        academicYear={academicYear}
        studyMode={studyModeVal}
        facultyId={facultyId || undefined}
        fieldOfStudyId={fieldOfStudyId || undefined}
        specializationId={specializationId || undefined}
      />
    </div>
  )
}

// ─── Zakładka Kalendarz semestru ───────────────────────────────

function CalendarTab({ academicYear }: { academicYear: string }) {
  const { semesterType } = useAcademicYearStore()
  const availableSemesters = SEMESTER_TYPE_NUMBERS[semesterType]

  // ── Sekcja 1: filtry kaskadowe ───────────────────────────────
  const [facultyId, setFacultyId] = useState('')
  const [studyMode, setStudyMode] = useState<StudyMode | ''>('')
  const [fieldOfStudyId, setFieldOfStudyId] = useState('')
  const [specializationId, setSpecializationId] = useState('')
  const [semester, setSemester] = useState('')

  // ── Sekcja 2: filtry widoku (client-side) ────────────────────
  const [filterGroupIds, setFilterGroupIds] = useState<Set<string> | null>(null)
  const [filterInstructorId, setFilterInstructorId] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClassType, setFilterClassType] = useState('')
  const [filterRoomId, setFilterRoomId] = useState('')

  // Reset filtrów widoku gdy zmienią się górne filtry zakresu
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
  // Kalendarz dopasowany do globalnego kontekstu (rok + semestr) i lokalnego trybu
  const selectedCalendar = studyMode
    ? (allCalendars.find(c => c.academicYear === academicYear && c.semesterType === semesterType && c.studyMode === studyMode) ?? null)
    : (allCalendars
        .filter(c => c.academicYear === academicYear && c.semesterType === semesterType)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null)

  // Wyznacz daty semestru — z bazy lub domyślne (identyczna logika co backend deriveCalendarDates)
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
  // Granice nawigacji jako poniedziałki (żeby porównywać weekStart do weekStart)
  const calMinMonday = calMin ? isoDate(getMonday(new Date(calMin + 'T12:00:00'))) : ''
  const calMaxMonday = calMax ? isoDate(getMonday(new Date(calMax + 'T12:00:00'))) : ''

  // Skocz do początku semestru gdy zmienia się kontekst lub ładuje się kalendarz
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

  // Zestaw ID grup dla wybranego kierunku/specjalności (do filtrowania widoku)
  const groupIdSet = useMemo(
    () => fieldOfStudyId ? new Set(groups.map(g => g.id)) : null,
    [fieldOfStudyId, groups]
  )

  const allEntries = entriesData?.data.data ?? []

  // Unikalne prowadzący i sale z załadowanych terminów (client-side)
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
    // Filtruj po trybie studiów na podstawie nazwy grupy (-SN- = niestacjonarne)
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
  }, [activeEntry, byDayAll, days, isPartTimeEntry])

  const hoverGhostEntry = useMemo(() => {
    if (!activeEntry || !overSlot) return null
    const [dayKey, slotTime] = overSlot.split('::')
    if (!dayKey || !slotTime) return null
    const startMins = timeToMins(slotTime)
    const durationMins = timeToMins(activeEntry.endTime) - timeToMins(activeEntry.startTime)
    const blockMins = durationMins
    if (startMins + blockMins > END_HOUR * 60) return null
    const proposedEnd = startMins + durationMins
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
    return { dayKey, startMins, blockMins, valid, conflicts, timeWindowViolation }
  }, [activeEntry, overSlot, byDayAll, isPartTimeEntry])

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
    const newEnd = minsToTime(newStartMins + durationMins)

    const currentDate = draggedEntry.date.slice(0, 10)
    if (currentDate === targetDate && draggedEntry.startTime === newStart) return

    // Blokuj upuszczenie poza oknem czasowym PART_TIME
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
      {/* ── Sekcja 1: Filtry kaskadowe ─────────────────────────── */}
      <div className="p-3 mb-2 bg-card rounded-lg border border-border">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Zakres widoku</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Wydział</label>
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
            <label className="text-[11px] text-muted-foreground">Tryb</label>
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
            <label className="text-[11px] text-muted-foreground">Kierunek</label>
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
            <label className="text-[11px] text-muted-foreground">Specjalność</label>
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
            <label className="text-[11px] text-muted-foreground">Semestr</label>
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
            <label className="text-[11px] text-muted-foreground">
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
      </div>

      {/* ── Sekcja 2: Filtry widoku + nawigacja tygodnia ───────── */}
      <div className="p-3 mb-3 bg-card rounded-lg border border-border">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Widok</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground">Typ zajęć</label>
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
            <label className="text-[11px] text-muted-foreground">Prowadzący</label>
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
            <label className="text-[11px] text-muted-foreground">Sala</label>
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
            <label className="text-[11px] text-muted-foreground">Status</label>
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

          <div className="flex flex-col justify-end gap-1 ml-auto">
            <label className="text-[11px] text-transparent select-none">_</label>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs"
              disabled={deleteManyMutation.isPending}
              onClick={() => {
                if (confirm('Usunąć WSZYSTKIE terminy z bazy danych? Tej operacji nie można cofnąć.')) {
                  deleteManyMutation.mutate()
                }
              }}
            >
              {deleteManyMutation.isPending ? 'Usuwanie...' : 'Wyczyść wszystkie terminy'}
            </Button>
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
                  <div className={`${holidayName ? 'min-h-[3.5rem]' : 'h-10'} border-b border-border flex flex-col items-center justify-center gap-0.5 text-xs font-medium px-1 ${holidayName ? 'bg-red-500/10 text-red-700 dark:text-red-400' : ''}`}>
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
                    {/* Ghost bloki valid pozycji podczas przeciągania */}
                    {dragInfoEntry?.[day.key]?.map(({ top, height }, i) => (
                      <div key={`v${i}`} style={{ position: 'absolute', top, height, left: 3, right: 3, zIndex: 0 }}
                        className="rounded border border-dashed border-green-500/50 pointer-events-none" />
                    ))}
                    {/* Ghost blok na aktualnej pozycji kursora */}
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
                            {hoverGhostEntry.timeWindowViolation ? (
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
          Brak terminów w tym tygodniu. Wygeneruj terminy z zakładki Wzorzec.
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

// ─── Główna strona ─────────────────────────────────────────────

export function SchedulePage() {
  const { academicYear, semesterType } = useAcademicYearStore()
  const [tab, setTab] = useState<'template' | 'calendar'>('template')

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Plan zajęć</h2>
        <p className="text-muted-foreground text-sm">Wzorzec tygodniowy i konkretne terminy</p>
      </div>

      {/* Zakładki */}
      <div className="flex gap-1 mb-4 border-b border-border">
        <button
          onClick={() => setTab('template')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'template'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Wzorzec tygodnia
        </button>
        <button
          onClick={() => setTab('calendar')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'calendar'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Kalendarz semestru
        </button>
      </div>

      {tab === 'template' && <TemplateTab key={`${academicYear}-${semesterType}`} academicYear={academicYear} />}
      {tab === 'calendar' && <CalendarTab key={`${academicYear}-${semesterType}`} academicYear={academicYear} />}
    </div>
  )
}
