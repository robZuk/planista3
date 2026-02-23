import { useState, useMemo } from 'react'
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
import { useAcademicYearStore, SEMESTER_TYPE_NUMBERS } from '@/store/academicYearStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type {
  ScheduleTemplate, ScheduleEntry,
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

const SLOT_HEIGHT = 32   // px per 30 min
const START_HOUR  = 7
const END_HOUR    = 20
const START_MINS  = START_HOUR * 60

function generateSlots(): string[] {
  const slots: string[] = []
  for (let h = START_HOUR; h < END_HOUR; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
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

function blockStyle(startTime: string, endTime: string): React.CSSProperties {
  const start = timeToMins(startTime) - START_MINS
  const duration = timeToMins(endTime) - timeToMins(startTime)
  return {
    position: 'absolute',
    top: (start / 30) * SLOT_HEIGHT,
    height: Math.max((duration / 30) * SLOT_HEIGHT - 2, 20),
    left: 4, right: 4,
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
    ...blockStyle(template.startTime, template.endTime),
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 1,
    cursor: 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`rounded border-l-4 px-2 py-1 text-xs overflow-hidden transition-opacity ${CLASS_COLORS[template.classType]}`}
    >
      <p className="font-semibold truncate leading-tight">{template.curriculumEntry.subject.name}</p>
      <p className="truncate opacity-70">
        {CLASS_LABELS[template.classType]} · {template.room.number} · {WEEK_TYPE_LABELS[template.weekType]}
      </p>
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
    ...blockStyle(entry.startTime, entry.endTime),
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : isCancelled ? 0.4 : 1,
    zIndex: isDragging ? 50 : 1,
    cursor: isCancelled ? 'default' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isCancelled ? {} : { ...listeners, ...attributes })}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`rounded border-l-4 px-2 py-1 text-xs overflow-hidden transition-opacity ${CLASS_COLORS[entry.classType]} ${isCancelled ? 'line-through' : ''}`}
    >
      <p className="font-semibold truncate leading-tight">{entry.curriculumEntry.subject.name}</p>
      <p className="truncate opacity-70">
        {CLASS_LABELS[entry.classType]} · {entry.room.number}
        {entry.status === 'CANCELLED' && ' · Odwołane'}
        {entry.status === 'MAKEUP' && ' · Odrobienie'}
      </p>
    </div>
  )
}

// ─── Droppable slot ───────────────────────────────────────────

function DroppableSlot({
  id,
  children,
  onClick,
}: {
  id: string
  children?: React.ReactNode
  onClick?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`absolute w-full transition-colors ${isOver ? 'bg-green-500/20' : ''}`}
      style={{ height: SLOT_HEIGHT }}
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
        {SLOTS.map((slot, i) => (
          <div
            key={slot}
            style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
            className="absolute w-full flex items-start justify-end pr-1 text-[10px] text-muted-foreground"
          >
            {slot.endsWith(':00') ? slot : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Dialog dodawania szablonu ────────────────────────────────

type AddTemplateForm = {
  curriculumVersionId: string
  curriculumEntryId: string
  classType: string
  academicHours: string
  roomId: string
  instructorId: string
  studentGroupId: string
  dayOfWeek: string
  startTime: string
  endTime: string
  weekType: string
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
  const [form, setForm] = useState<AddTemplateForm>({
    curriculumVersionId: '',
    curriculumEntryId: '',
    classType: 'LECTURE',
    academicHours: '2',
    roomId: '',
    instructorId: '',
    studentGroupId: '__none__',
    dayOfWeek: prefill?.dayOfWeek ?? 'MONDAY',
    startTime: prefill?.startTime ?? '08:00',
    endTime: prefill?.startTime ? minsToTime(timeToMins(prefill.startTime) + 90) : '09:30',
    weekType: 'EVERY',
  })
  const [error, setError] = useState('')

  const { data: versionsData } = useQuery({
    queryKey: ['curriculum-versions'],
    queryFn: () => curriculumApi.getVersions(),
    enabled: open,
  })

  const { data: entriesData } = useQuery({
    queryKey: ['curriculum-entries', form.curriculumVersionId, semester],
    queryFn: () => curriculumApi.getEntries(form.curriculumVersionId, semester),
    enabled: open && !!form.curriculumVersionId,
  })

  const { data: buildingsData } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => buildingsApi.getAll(),
    enabled: open,
  })

  const { data: instructorsData } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.getAll(),
    enabled: open,
  })

  const { data: groupsData } = useQuery({
    queryKey: ['groups', semester, academicYear],
    queryFn: () => groupsApi.getAll({ semester, academicYear }),
    enabled: open,
  })

  const versions = versionsData?.data.data ?? []
  const semestersData = entriesData?.data.data
  const semEntries: SemesterEntries[] = semestersData?.semesters ?? []
  const curriculumEntries = semEntries.flatMap(s => s.entries)

  const allRooms = buildingsData?.data.data.flatMap(b => b.rooms.map(r => ({ ...r, buildingName: b.name }))) ?? []
  const instructors = instructorsData?.data.data ?? []
  const groups = groupsData?.data.data ?? []

  const mutation = useMutation({
    mutationFn: () => scheduleApi.createTemplate({
      curriculumEntryId: form.curriculumEntryId,
      classType: form.classType,
      academicHours: Number(form.academicHours),
      roomId: form.roomId,
      instructorId: form.instructorId,
      studentGroupId: form.studentGroupId !== '__none__' ? form.studentGroupId : undefined,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      semester,
      academicYear,
      weekType: form.weekType,
      studyMode,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      onSuccess()
      onClose()
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd'
      setError(msg)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dodaj zajęcia do wzorca</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Plan nauczania</Label>
              <Select value={form.curriculumVersionId} onValueChange={v => setForm(f => ({ ...f, curriculumVersionId: v, curriculumEntryId: '' }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz wersję" /></SelectTrigger>
                <SelectContent>
                  {versions.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.specialization?.shortName} {v.academicYear} {v.studyMode === 'FULL_TIME' ? 'St.' : 'Nst.'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1">
              <Label>Przedmiot</Label>
              <Select value={form.curriculumEntryId} onValueChange={v => setForm(f => ({ ...f, curriculumEntryId: v }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz przedmiot" /></SelectTrigger>
                <SelectContent>
                  {curriculumEntries.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.subject.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Typ zajęć</Label>
              <Select value={form.classType} onValueChange={v => setForm(f => ({ ...f, classType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['LECTURE','EXERCISE','LAB','PROJECT','SEMINAR'] as ClassType[]).map(t => (
                    <SelectItem key={t} value={t}>{CLASS_LABELS[t]} – {t}</SelectItem>
                  ))}
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
                  {DAYS_FULL.concat(DAYS_PART.filter(d => !DAYS_FULL.find(f => f.key === d.key))).map(d => (
                    <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                  ))}
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

            <div className="col-span-2 space-y-1">
              <Label>Sala</Label>
              <Select value={form.roomId} onValueChange={v => setForm(f => ({ ...f, roomId: v }))}>
                <SelectTrigger><SelectValue placeholder="Wybierz salę" /></SelectTrigger>
                <SelectContent>
                  {allRooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.number} ({r.type}, poj. {r.capacity}) – {(r as { buildingName?: string }).buildingName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1">
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

            <div className="col-span-2 space-y-1">
              <Label>Grupa (opcjonalnie)</Label>
              <Select value={form.studentGroupId} onValueChange={v => setForm(f => ({ ...f, studentGroupId: v }))}>
                <SelectTrigger><SelectValue placeholder="Brak / wszystkie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Brak</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.curriculumEntryId || !form.roomId || !form.instructorId}
          >
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
  const [weekType, setWeekType] = useState(template.weekType)
  const [startTime, setStartTime] = useState(template.startTime)
  const [endTime, setEndTime] = useState(template.endTime)
  const [error, setError] = useState('')

  const updateMutation = useMutation({
    mutationFn: () => scheduleApi.updateTemplate(template.id, { weekType, startTime, endTime }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); onSuccess(); onClose() },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => scheduleApi.deleteTemplate(template.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); onClose() },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edytuj wzorzec zajęć</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          {error && <p className="text-destructive">{error}</p>}
          <p><span className="font-medium">Przedmiot:</span> {template.curriculumEntry.subject.name}</p>
          <p><span className="font-medium">Typ:</span> {CLASS_LABELS[template.classType]}</p>
          <p><span className="font-medium">Prowadzący:</span> {template.instructor.firstName} {template.instructor.lastName}</p>
          <p><span className="font-medium">Sala:</span> {template.room.number} ({template.room.building.name})</p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <Label>Od</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Do</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Cykl</Label>
              <Select value={weekType} onValueChange={v => setWeekType(v as typeof weekType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EVERY">Co tydzień</SelectItem>
                  <SelectItem value="EVEN">Tygodnie parzyste</SelectItem>
                  <SelectItem value="ODD">Tygodnie nieparzyste</SelectItem>
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
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
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
  templateIds,
  onClose,
}: {
  open: boolean
  templateIds: string[]
  onClose: () => void
}) {
  const [calendarId, setCalendarId] = useState('')
  const [result, setResult] = useState<{ created: number; skipped: number; conflicts: number } | null>(null)
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const { data: calendarsData } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => scheduleApi.getCalendars(),
    enabled: open,
  })
  const calendars = calendarsData?.data.data ?? []

  const mutation = useMutation({
    mutationFn: () => scheduleApi.generateSemester({ templateIds, calendarId }),
    onSuccess: (res) => {
      setResult(res.data.data)
      qc.invalidateQueries({ queryKey: ['entries'] })
    },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Generuj terminy semestru</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result ? (
            <div className="text-sm space-y-1">
              <p className="text-green-600 font-medium">Gotowe!</p>
              <p>Utworzono: <b>{result.created}</b> terminów</p>
              <p>Pominięto: <b>{result.skipped}</b> (święta / poza oknem)</p>
              <p>Konflikty: <b>{result.conflicts}</b></p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Wybranych wzorców: {templateIds.length}</p>
              <div className="space-y-1">
                <Label>Kalendarz semestru</Label>
                <Select value={calendarId} onValueChange={setCalendarId}>
                  <SelectTrigger><SelectValue placeholder="Wybierz kalendarz" /></SelectTrigger>
                  <SelectContent>
                    {calendars.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.academicYear} {c.semesterType} {c.studyMode === 'FULL_TIME' ? 'St.' : 'Nst.'} ({c.teachingWeeks} tyg.)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {result ? 'Zamknij' : 'Anuluj'}
          </Button>
          {!result && (
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !calendarId || templateIds.length === 0}
            >
              {mutation.isPending ? 'Generowanie...' : 'Generuj'}
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
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd')
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

// ─── Szczegóły wpisu ──────────────────────────────────────────

function EntryDetailPanel({
  entry,
  onClose,
}: {
  entry: ScheduleEntry
  onClose: () => void
}) {
  const qc = useQueryClient()
  const cancelMutation = useMutation({
    mutationFn: () => scheduleApi.deleteEntry(entry.id, true),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entries'] }); onClose() },
  })

  const deleteMutation = useMutation({
    mutationFn: () => scheduleApi.deleteEntry(entry.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entries'] }); onClose() },
  })

  return (
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
            onClick={() => { if (confirm('Trwale usunąć ten termin z bazy danych?')) deleteMutation.mutate() }}
            disabled={deleteMutation.isPending || cancelMutation.isPending}
          >
            {deleteMutation.isPending ? 'Usuwanie...' : 'Usuń termin'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Zakładka Wzorzec tygodnia ─────────────────────────────────

function TemplateTab({
  academicYear,
  semester,
  studyMode,
}: {
  academicYear: string
  semester: number
  studyMode: StudyMode
}) {
  const days = studyMode === 'FULL_TIME' ? DAYS_FULL : DAYS_PART
  const [addSlot, setAddSlot] = useState<{ dayOfWeek: string; startTime: string } | null>(null)
  const [editTemplate, setEditTemplate] = useState<ScheduleTemplate | null>(null)
  const [showGenerateSemester, setShowGenerateSemester] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const { data, refetch } = useQuery({
    queryKey: ['templates', semester, academicYear, studyMode],
    queryFn: () => scheduleApi.getTemplates({ semester, academicYear, studyMode }),
  })

  const templates = data?.data.data ?? []

  const byDay = useMemo(() => {
    const map: Record<string, ScheduleTemplate[]> = {}
    for (const d of days) map[d.key] = []
    for (const t of templates) {
      if (map[t.dayOfWeek]) map[t.dayOfWeek]!.push(t)
    }
    return map
  }, [templates, days])

  const activeTemplate = activeId ? templates.find(t => t.id === activeId) : null

  const qc = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: ({ id, dayOfWeek, startTime, endTime }: { id: string; dayOfWeek: string; startTime: string; endTime: string }) =>
      scheduleApi.updateTemplate(id, { dayOfWeek, startTime, endTime }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  })

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
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

    updateMutation.mutate({ id: tpl.id, dayOfWeek: day, startTime: newStart, endTime: newEnd })
  }

  const totalSlotsHeight = SLOTS.length * SLOT_HEIGHT

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={() => setShowGenerateSemester(true)} disabled={templates.length === 0}>
          Generuj terminy semestru ({templates.length} wzorców)
        </Button>
      </div>

      <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                      onClick={() => setAddSlot({ dayOfWeek: day.key, startTime: slot })}
                    >
                      <div
                        style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                        className={`absolute w-full border-b ${slot.endsWith(':00') ? 'border-border' : 'border-border/30'} pointer-events-none`}
                      />
                    </DroppableSlot>
                  ))}
                  {byDay[day.key]?.map(t => (
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
              style={{ height: Math.max(((timeToMins(activeTemplate.endTime) - timeToMins(activeTemplate.startTime)) / 30) * SLOT_HEIGHT - 2, 20) }}
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
          semester={semester}
          academicYear={academicYear}
          studyMode={studyMode}
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
          templateIds={templates.map(t => t.id)}
          onClose={() => setShowGenerateSemester(false)}
        />
      )}
    </div>
  )
}

// ─── Zakładka Kalendarz semestru ───────────────────────────────

function CalendarTab({
  academicYear,
  studyMode,
}: {
  academicYear: string
  studyMode: StudyMode
}) {
  const days = studyMode === 'FULL_TIME' ? DAYS_FULL : DAYS_PART
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [filterGroupId, setFilterGroupId] = useState('__all__')
  const [filterInstructorId, setFilterInstructorId] = useState('__all__')
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null)
  const [moveState, setMoveState] = useState<{
    entry: ScheduleEntry
    targetDay: DayOfWeek
    targetSlot: string
  } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showCalendarDialog, setShowCalendarDialog] = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart])
  const fromStr = isoDate(weekDates['MONDAY'])
  const toStr = isoDate(weekDates['SUNDAY'])

  const { data: entriesData, refetch } = useQuery({
    queryKey: ['entries', fromStr, toStr, filterGroupId, filterInstructorId],
    queryFn: () => scheduleApi.getEntries({
      from: fromStr,
      to: toStr,
      studentGroupId: filterGroupId !== '__all__' ? filterGroupId : undefined,
      instructorId: filterInstructorId !== '__all__' ? filterInstructorId : undefined,
    }),
  })

  const { data: holidaysData } = useQuery({
    queryKey: ['holidays', fromStr, toStr],
    queryFn: () => scheduleApi.getHolidays({ from: fromStr, to: toStr }),
  })

  const { data: groupsData } = useQuery({
    queryKey: ['groups-all', academicYear],
    queryFn: () => groupsApi.getAll({ academicYear }),
  })

  const { data: instructorsData } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.getAll(),
  })

  const entries = entriesData?.data.data ?? []
  const holidays = holidaysData?.data.data ?? []
  const groups = groupsData?.data.data ?? []
  const instructors = instructorsData?.data.data ?? []

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

  const activeEntry = activeId ? entries.find(e => e.id === activeId) : null

  function prevWeek() {
    setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
  }
  function nextWeek() {
    setWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
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

    setMoveState({ entry: draggedEntry, targetDay, targetSlot: slotTime })
  }

  const totalSlotsHeight = SLOTS.length * SLOT_HEIGHT

  const weekLabel = `${formatDate(weekDates['MONDAY'])} – ${formatDate(weekDates['SUNDAY'])}`

  return (
    <div>
      {/* Nawigacja tygodnia */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevWeek}>← Poprzedni</Button>
          <span className="text-sm font-medium min-w-[180px] text-center">{weekLabel}</span>
          <Button variant="outline" size="sm" onClick={nextWeek}>Następny →</Button>
        </div>

        <Select value={filterGroupId} onValueChange={setFilterGroupId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Wszystkie grupy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Wszystkie grupy</SelectItem>
            {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterInstructorId} onValueChange={setFilterInstructorId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Wszyscy prowadzący" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Wszyscy prowadzący</SelectItem>
            {instructors.map(i => (
              <SelectItem key={i.id} value={i.id}>{i.firstName} {i.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => setShowCalendarDialog(true)}>
          Kalendarze
        </Button>
      </div>

      <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                  <div className={`h-10 border-b border-border flex flex-col items-center justify-center text-xs font-medium ${holidayName ? 'bg-red-500/10 text-red-700 dark:text-red-400' : ''}`}>
                    <span>{day.label}</span>
                    <span className="text-[10px] opacity-70">{formatDate(dayDate)}</span>
                    {holidayName && <span className="text-[9px] truncate px-1">{holidayName}</span>}
                  </div>
                  <div style={{ height: totalSlotsHeight }} className="relative">
                    {holidayName && (
                      <div className="absolute inset-0 bg-red-500/8 pointer-events-none" />
                    )}
                    {SLOTS.map((slot, i) => (
                      <DroppableSlot
                        key={slot}
                        id={`${day.key}::${slot}`}
                      >
                        <div
                          style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                          className={`absolute w-full border-b ${slot.endsWith(':00') ? 'border-border' : 'border-border/30'} pointer-events-none`}
                        />
                      </DroppableSlot>
                    ))}
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
              style={{ height: Math.max(((timeToMins(activeEntry.endTime) - timeToMins(activeEntry.startTime)) / 30) * SLOT_HEIGHT - 2, 20) }}
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
    </div>
  )
}

// ─── Główna strona ─────────────────────────────────────────────

export function SchedulePage() {
  const { academicYear, semesterType } = useAcademicYearStore()
  const [tab, setTab] = useState<'template' | 'calendar'>('template')
  const [semester, setSemester] = useState<string>('')
  const [studyMode, setStudyMode] = useState<StudyMode>('FULL_TIME')

  const availableSemesters = SEMESTER_TYPE_NUMBERS[semesterType]

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Plan zajęć</h2>
        <p className="text-muted-foreground text-sm">Wzorzec tygodniowy i konkretne terminy</p>
      </div>

      {/* Filtry globalne */}
      <div className="flex flex-wrap gap-3 mb-4 p-4 bg-card rounded-lg border border-border">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Semestr</label>
          <Select value={semester || undefined} onValueChange={setSemester}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Wszystkie" />
            </SelectTrigger>
            <SelectContent>
              {availableSemesters.map(s => (
                <SelectItem key={s} value={String(s)}>Semestr {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Tryb studiów</label>
          <Select value={studyMode} onValueChange={v => setStudyMode(v as StudyMode)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FULL_TIME">Stacjonarne</SelectItem>
              <SelectItem value="PART_TIME">Niestacjonarne</SelectItem>
            </SelectContent>
          </Select>
        </div>
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

      {tab === 'template' && (
        <TemplateTab
          academicYear={academicYear}
          semester={semester ? parseInt(semester) : (availableSemesters[0] ?? 1)}
          studyMode={studyMode}
        />
      )}

      {tab === 'calendar' && (
        <CalendarTab
          academicYear={academicYear}
          studyMode={studyMode}
        />
      )}
    </div>
  )
}
