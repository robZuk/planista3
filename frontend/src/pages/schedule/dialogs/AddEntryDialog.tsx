import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedule'
import { buildingsApi } from '@/api/buildings'
import { instructorsApi } from '@/api/instructors'
import { groupsApi } from '@/api/groups'
import { curriculumApi } from '@/api/curriculum'
import { facultiesApi, specsApi } from '@/api/faculties'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ClassType, StudyMode, SemesterEntries } from '@/types'
import { CLASS_FULL_LABELS, ROOM_TYPES_FOR_CLASS, type SpecWithChain } from '../lib/constants'
import { minsToTime, timeToMins } from '../lib/time'
import { formatApiError } from '../lib/errors'

export function AddEntryDialog({
  open, date, startTime, academicYear, studyMode, semesterType, calendarId, onClose, onSuccess,
}: {
  open: boolean
  date: string
  startTime: string
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
