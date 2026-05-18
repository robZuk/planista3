import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedule'
import { buildingsApi } from '@/api/buildings'
import { instructorsApi } from '@/api/instructors'
import { groupsApi } from '@/api/groups'
import { curriculumApi } from '@/api/curriculum'
import { facultiesApi, specsApi } from '@/api/faculties'
import { useAcademicYearStore, SEMESTER_TYPE_NUMBERS } from '@/store/academicYearStore'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ClassType, DayOfWeek, StudyMode, SemesterEntries } from '@/types'
import {
  CLASS_LABELS, DAYS_FULL, DAYS_PART, ROOM_TYPES_FOR_CLASS,
  type SpecWithChain,
} from '../lib/constants'
import { minsToTime, timeToMins } from '../lib/time'
import { formatApiError } from '../lib/errors'

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

export function AddTemplateDialog({
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
  const { semesterType } = useAcademicYearStore()
  const availableSemesters = SEMESTER_TYPE_NUMBERS[semesterType]

  const [facultyId,      setFacultyId]      = useState('')
  const [fieldId,        setFieldId]        = useState('')
  const [specId,         setSpecId]         = useState('')
  const [effectiveMode,  setEffectiveMode]  = useState<string>(studyMode ?? 'FULL_TIME')
  const [filterSemester, setFilterSemester] = useState<number>(semester)
  const [groupId,        setGroupId]        = useState('')

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

  useEffect(() => {
    if (!open) return
    setFacultyId(''); setFieldId(''); setSpecId('')
    setEffectiveMode(studyMode ?? 'FULL_TIME')
    setFilterSemester(semester)
    setGroupId('')
    setForm(emptyForm())
    setError('')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

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
    queryKey: ['groups', filterSemester, academicYear],
    queryFn:  () => groupsApi.getAll({ semester: filterSemester, academicYear }),
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

  const faculties   = facultiesData?.data.data  ?? []
  const allSpecs    = (allSpecsData?.data.data  ?? []) as SpecWithChain[]
  const versions    = versionsData?.data.data   ?? []
  const groups      = groupsData?.data.data     ?? []
  const allRooms    = buildingsData?.data.data.flatMap(b => b.rooms.map(r => ({ ...r, buildingName: b.name }))) ?? []
  const instructors = instructorsData?.data.data ?? []

  const selectedGroup   = groups.find(g => g.id === groupId)
  const effectiveSemester = selectedGroup?.semester ?? semester

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

  const DAYS_ALL = [...DAYS_FULL, { key: 'SATURDAY' as DayOfWeek, label: 'Sobota' }, { key: 'SUNDAY' as DayOfWeek, label: 'Niedziela' }]
  const days = effectiveMode === 'PART_TIME' ? DAYS_PART : effectiveMode === 'FULL_TIME' ? DAYS_FULL : DAYS_ALL

  const handleGroupSelect = (gId: string) => {
    const g = groups.find(x => x.id === gId)
    if (!g) { setGroupId(''); return }
    setGroupId(gId)

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

    const classType = g.type as string

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

              <div className="space-y-1">
                <Label className="text-xs">Semestr</Label>
                <Select value={String(filterSemester)} onValueChange={v => {
                  setFilterSemester(Number(v)); setGroupId('')
                  setForm(f => ({ ...f, curriculumEntryId: '', classType: '', roomId: '' }))
                }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableSemesters.map(n => <SelectItem key={n} value={String(n)}>Sem. {n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Przedmiot <span className="text-destructive">*</span></Label>
              <Select
                value={form.curriculumEntryId}
                onValueChange={v => {
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
