import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Plus, Pencil, ChevronDown } from 'lucide-react'
import { curriculumApi } from '@/api/curriculum'
import { instructorsApi } from '@/api/instructors'
import { useAuthStore } from '@/store/authStore'
import { useAcademicYearStore, SEMESTER_TYPE_NUMBERS } from '@/store/academicYearStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { CurriculumEntry, CurriculumVersion, SemesterEntries } from '@/types'

const ASSESSMENT_LABELS: Record<string, string> = {
  EXAM: 'Egzamin',
  CREDIT: 'Zaliczenie',
}

const DEGREE_LABELS: Record<string, string> = {
  BACHELOR: 'Inżynierskie / Licencjackie',
  MASTER: 'Magisterskie',
}

// ─── EditEntryDialog ──────────────────────────────────────────────────────────

function EditEntryDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: CurriculumEntry
  onClose: () => void
  onSaved: () => void
}) {
  const [instructorId, setInstructorId] = useState(entry.instructor?.id ?? '')
  const [hoursLecture, setHoursLecture] = useState(String(entry.hoursLecture))
  const [hoursExercise, setHoursExercise] = useState(String(entry.hoursExercise))
  const [hoursLab, setHoursLab] = useState(String(entry.hoursLab))
  const [hoursProject, setHoursProject] = useState(String(entry.hoursProject))
  const [hoursSeminar, setHoursSeminar] = useState(String(entry.hoursSeminar))
  const [ects, setEcts] = useState(String(entry.ects))
  const [assessmentType, setAssessmentType] = useState(entry.assessmentType)

  const { data: instructorsData } = useQuery({
    queryKey: ['instructors-for-entry'],
    queryFn: () => instructorsApi.getAll(),
  })
  const instructors = instructorsData?.data.data ?? []

  const saveMutation = useMutation({
    mutationFn: () =>
      curriculumApi.updateEntry(entry.id, {
        instructorId: instructorId || null,
        hoursLecture: parseInt(hoursLecture) || 0,
        hoursExercise: parseInt(hoursExercise) || 0,
        hoursLab: parseInt(hoursLab) || 0,
        hoursProject: parseInt(hoursProject) || 0,
        hoursSeminar: parseInt(hoursSeminar) || 0,
        ects: parseInt(ects) || 0,
        assessmentType,
      }),
    onSuccess: () => { onSaved(); onClose() },
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Edytuj wpis</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <p className="text-sm font-medium">{entry.subject.name}</p>
            {entry.subject.code && (
              <p className="text-xs text-muted-foreground">{entry.subject.code}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Prowadzący</Label>
            <Select value={instructorId || 'none'} onValueChange={(v) => setInstructorId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Nie przypisany" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nie przypisany</SelectItem>
                {instructors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.title ? `${i.title} ` : ''}{i.lastName} {i.firstName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">Godziny</Label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'W', state: hoursLecture, set: setHoursLecture },
                { label: 'C', state: hoursExercise, set: setHoursExercise },
                { label: 'L', state: hoursLab, set: setHoursLab },
                { label: 'P', state: hoursProject, set: setHoursProject },
                { label: 'S', state: hoursSeminar, set: setHoursSeminar },
              ].map(({ label, state, set }) => (
                <div key={label} className="space-y-1">
                  <Label className="text-xs text-center block">{label}</Label>
                  <Input type="number" min={0} value={state} onChange={(e) => set(e.target.value)} className="text-center px-1" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>ECTS</Label>
              <Input type="number" min={0} value={ects} onChange={(e) => setEcts(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Forma zaliczenia</Label>
              <Select value={assessmentType} onValueChange={setAssessmentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREDIT">Zaliczenie</SelectItem>
                  <SelectItem value="EXAM">Egzamin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
            <Button variant="outline" onClick={onClose}>Anuluj</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── SemesterTable ────────────────────────────────────────────────────────────

function SemesterTable({
  semester,
  entries,
  totalEcts,
  canEdit,
  onEditEntry,
  onDeleteEntry,
  onAddEntry,
}: {
  semester: number
  entries: CurriculumEntry[]
  totalEcts: number
  canEdit: boolean
  onEditEntry: (entry: CurriculumEntry) => void
  onDeleteEntry: (id: string, subjectName: string) => void
  onAddEntry: (semester: number, nextOrder: number) => void
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-base font-semibold text-foreground">Semestr {semester}</h3>
        <Badge variant="secondary">{totalEcts} ECTS</Badge>
        {canEdit && (
          <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => onAddEntry(semester, entries.length + 1)}>
            <Plus size={12} className="mr-1" />
            Dodaj przedmiot
          </Button>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-8">Lp</th>
              <th className="text-left px-3 py-2 font-medium min-w-48">Przedmiot</th>
              <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Prowadzący</th>
              <th className="text-center px-2 py-2 font-medium">W</th>
              <th className="text-center px-2 py-2 font-medium">C</th>
              <th className="text-center px-2 py-2 font-medium">L</th>
              <th className="text-center px-2 py-2 font-medium">P</th>
              <th className="text-center px-2 py-2 font-medium">S</th>
              <th className="text-center px-2 py-2 font-medium">Σ</th>
              <th className="text-center px-2 py-2 font-medium">ECTS</th>
              <th className="text-center px-2 py-2 font-medium hidden lg:table-cell">Zal.</th>
              {canEdit && <th className="w-16" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry, idx) => (
              <tr key={entry.id} className="hover:bg-muted/50 group">
                <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-2 font-medium">
                  {entry.subject.name}
                  {entry.subject.code && (
                    <span className="ml-1 text-xs text-muted-foreground">[{entry.subject.code}]</span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground hidden md:table-cell text-xs">
                  {entry.instructor
                    ? `${entry.instructor.title ?? ''} ${entry.instructor.lastName}`.trim()
                    : '—'}
                </td>
                <td className="px-2 py-2 text-center">{entry.hoursLecture}</td>
                <td className="px-2 py-2 text-center">{entry.hoursExercise}</td>
                <td className="px-2 py-2 text-center">{entry.hoursLab}</td>
                <td className="px-2 py-2 text-center">{entry.hoursProject}</td>
                <td className="px-2 py-2 text-center">{entry.hoursSeminar}</td>
                <td className="px-2 py-2 text-center font-medium">{entry.totalHours}</td>
                <td className="px-2 py-2 text-center">{entry.ects}</td>
                <td className="px-2 py-2 text-center text-xs text-muted-foreground hidden lg:table-cell">
                  {ASSESSMENT_LABELS[entry.assessmentType]}
                </td>
                {canEdit && (
                  <td className="px-1 py-2">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => onEditEntry(entry)}
                      >
                        <Pencil size={11} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => onDeleteEntry(entry.id, entry.subject.name)}
                      >
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={canEdit ? 12 : 11} className="text-center py-4 text-muted-foreground text-sm">
                  Brak wpisów w tym semestrze
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── CreateVersionDialog ──────────────────────────────────────────────────────

function CreateVersionDialog({
  onClose,
  onCreated,
  defaultAcademicYear,
}: {
  onClose: () => void
  onCreated: (versionId: string) => void
  defaultAcademicYear: string
}) {
  const [facultyId, setFacultyId] = useState('')
  const [fieldOfStudyId, setFieldOfStudyId] = useState('')
  const [specializationId, setSpecializationId] = useState('')
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear)
  const [studyMode, setStudyMode] = useState('')
  const [degreeLevel, setDegreeLevel] = useState('')
  const [totalSemesters, setTotalSemesters] = useState('7')

  const { data: facultiesData } = useQuery({
    queryKey: ['faculties-cv'],
    queryFn: () => curriculumApi.getFaculties(),
  })
  const { data: fieldsData } = useQuery({
    queryKey: ['fields-cv', facultyId],
    queryFn: () => curriculumApi.getFieldsOfStudy(facultyId),
    enabled: !!facultyId,
  })
  const { data: specsData } = useQuery({
    queryKey: ['specs-cv', fieldOfStudyId],
    queryFn: () => curriculumApi.getSpecializations(fieldOfStudyId),
    enabled: !!fieldOfStudyId,
  })

  const faculties = facultiesData?.data.data ?? []
  const fields = fieldsData?.data.data ?? []
  const specs = specsData?.data.data ?? []

  const createMutation = useMutation({
    mutationFn: () =>
      curriculumApi.createVersion({
        academicYear,
        studyMode,
        degreeLevel,
        totalSemesters: parseInt(totalSemesters),
        specializationId,
      }),
    onSuccess: (res) => {
      onCreated(res.data.data.id)
      onClose()
    },
  })

  const canSave = !!specializationId && !!academicYear && !!studyMode && !!degreeLevel && !!totalSemesters && !createMutation.isPending

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Nowa siatka godzin</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Wydział</Label>
              <Select value={facultyId} onValueChange={(v) => { setFacultyId(v); setFieldOfStudyId(''); setSpecializationId('') }}>
                <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                <SelectContent>
                  {faculties.map((f) => <SelectItem key={f.id} value={f.id}>{f.shortName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Kierunek</Label>
              <Select value={fieldOfStudyId} onValueChange={(v) => { setFieldOfStudyId(v); setSpecializationId('') }} disabled={!facultyId}>
                <SelectTrigger><SelectValue placeholder={!facultyId ? 'Najpierw wydział' : 'Wybierz'} /></SelectTrigger>
                <SelectContent>
                  {fields.map((f) => <SelectItem key={f.id} value={f.id}>{f.shortName} — {f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Specjalność</Label>
            <Select value={specializationId} onValueChange={setSpecializationId} disabled={!fieldOfStudyId}>
              <SelectTrigger><SelectValue placeholder={!fieldOfStudyId ? 'Najpierw kierunek' : 'Wybierz'} /></SelectTrigger>
              <SelectContent>
                {specs.map((s) => <SelectItem key={s.id} value={s.id}>{s.shortName} — {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rok akademicki</Label>
              <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="np. 2024/2025" />
            </div>
            <div className="space-y-1.5">
              <Label>Liczba semestrów</Label>
              <Input type="number" min={1} max={14} value={totalSemesters} onChange={(e) => setTotalSemesters(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tryb studiów</Label>
              <Select value={studyMode} onValueChange={setStudyMode}>
                <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_TIME">Stacjonarne</SelectItem>
                  <SelectItem value="PART_TIME">Niestacjonarne</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Stopień</Label>
              <Select value={degreeLevel} onValueChange={setDegreeLevel}>
                <SelectTrigger><SelectValue placeholder="Wybierz" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DEGREE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {createMutation.isError && (
            <p className="text-sm text-destructive">Błąd — taka siatka może już istnieć</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" disabled={!canSave} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? 'Tworzenie...' : 'Utwórz siatkę'}
            </Button>
            <Button variant="outline" onClick={onClose}>Anuluj</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── EditVersionDialog ────────────────────────────────────────────────────────

function EditVersionDialog({
  version,
  onClose,
  onSaved,
}: {
  version: CurriculumVersion
  onClose: () => void
  onSaved: () => void
}) {
  const [totalSemesters, setTotalSemesters] = useState(String(version.totalSemesters))
  const [isActive, setIsActive] = useState(version.isActive)

  const updateMutation = useMutation({
    mutationFn: () =>
      curriculumApi.updateVersion(version.id, {
        totalSemesters: parseInt(totalSemesters),
        isActive,
      }),
    onSuccess: () => { onSaved(); onClose() },
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Edytuj siatkę godzin</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Rok akademicki</Label>
            <p className="text-sm text-muted-foreground">{version.academicYear}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Specjalność</Label>
            <p className="text-sm text-muted-foreground">{version.specialization?.name ?? '—'}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Tryb studiów</Label>
            <p className="text-sm text-muted-foreground">{version.studyMode === 'FULL_TIME' ? 'Stacjonarne' : 'Niestacjonarne'}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Liczba semestrów</Label>
            <Input type="number" min={1} max={14} value={totalSemesters} onChange={(e) => setTotalSemesters(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="isActive" className="cursor-pointer">Aktywna wersja</Label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
            <Button variant="outline" onClick={onClose}>Anuluj</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── AddEntryDialog ───────────────────────────────────────────────────────────

function AddEntryDialog({
  versionId,
  semester,
  nextOrder,
  onClose,
  onSaved,
}: {
  versionId: string
  semester: number
  nextOrder: number
  onClose: () => void
  onSaved: () => void
}) {
  const [subjectSearch, setSubjectSearch] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [instructorId, setInstructorId] = useState('')
  const [hoursLecture, setHoursLecture] = useState('0')
  const [hoursExercise, setHoursExercise] = useState('0')
  const [hoursLab, setHoursLab] = useState('0')
  const [hoursProject, setHoursProject] = useState('0')
  const [hoursSeminar, setHoursSeminar] = useState('0')
  const [ects, setEcts] = useState('0')
  const [assessmentType, setAssessmentType] = useState('CREDIT')

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-for-entry'],
    queryFn: () => curriculumApi.getSubjects(),
  })
  const { data: instructorsData } = useQuery({
    queryKey: ['instructors-for-entry'],
    queryFn: () => instructorsApi.getAll(),
  })

  const subjects = subjectsData?.data.data ?? []
  const instructors = instructorsData?.data.data ?? []
  const filteredSubjects = subjectSearch
    ? subjects.filter((s) =>
        s.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
        (s.code ?? '').toLowerCase().includes(subjectSearch.toLowerCase())
      )
    : subjects

  const addMutation = useMutation({
    mutationFn: () =>
      curriculumApi.addEntry(versionId, {
        subjectId: selectedSubjectId,
        instructorId: instructorId || undefined,
        semester,
        orderInSemester: nextOrder,
        hoursLecture: parseInt(hoursLecture) || 0,
        hoursExercise: parseInt(hoursExercise) || 0,
        hoursLab: parseInt(hoursLab) || 0,
        hoursProject: parseInt(hoursProject) || 0,
        hoursSeminar: parseInt(hoursSeminar) || 0,
        ects: parseInt(ects) || 0,
        assessmentType,
      }),
    onSuccess: () => { onSaved(); onClose() },
  })

  const canSave = !!selectedSubjectId && !addMutation.isPending

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Dodaj przedmiot — semestr {semester}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Przedmiot</Label>
            <div className="relative">
              <Input
                placeholder="Szukaj nazwy lub kodu..."
                value={subjectSearch}
                onChange={(e) => { setSubjectSearch(e.target.value); setSelectedSubjectId('') }}
              />
              {selectedSubjectId && (
                <p className="mt-1 text-xs text-green-700 dark:text-green-400 font-medium">
                  ✓ {subjects.find((s) => s.id === selectedSubjectId)?.name}
                </p>
              )}
              {subjectSearch && !selectedSubjectId && (
                <div className="absolute z-20 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-44 overflow-y-auto">
                  {filteredSubjects.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Brak wyników</p>
                  ) : (
                    filteredSubjects.slice(0, 50).map((s) => (
                      <div
                        key={s.id}
                        className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setSelectedSubjectId(s.id); setSubjectSearch(s.name) }}
                      >
                        {s.name}
                        {s.code && <span className="ml-1 text-xs text-muted-foreground">[{s.code}]</span>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Prowadzący (opcjonalnie)</Label>
            <Select value={instructorId || 'none'} onValueChange={(v) => setInstructorId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Nie przypisany" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nie przypisany</SelectItem>
                {instructors.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.title ? `${i.title} ` : ''}{i.lastName} {i.firstName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">Godziny</Label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'W', state: hoursLecture, set: setHoursLecture },
                { label: 'C', state: hoursExercise, set: setHoursExercise },
                { label: 'L', state: hoursLab, set: setHoursLab },
                { label: 'P', state: hoursProject, set: setHoursProject },
                { label: 'S', state: hoursSeminar, set: setHoursSeminar },
              ].map(({ label, state, set }) => (
                <div key={label} className="space-y-1">
                  <Label className="text-xs text-center block">{label}</Label>
                  <Input type="number" min={0} value={state} onChange={(e) => set(e.target.value)} className="text-center px-1" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>ECTS</Label>
              <Input type="number" min={0} value={ects} onChange={(e) => setEcts(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Forma zaliczenia</Label>
              <Select value={assessmentType} onValueChange={setAssessmentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREDIT">Zaliczenie</SelectItem>
                  <SelectItem value="EXAM">Egzamin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {addMutation.isError && (
            <p className="text-sm text-destructive">Błąd — ten przedmiot może już być w siatce</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" disabled={!canSave} onClick={() => addMutation.mutate()}>
              {addMutation.isPending ? 'Zapisywanie...' : 'Dodaj'}
            </Button>
            <Button variant="outline" onClick={onClose}>Anuluj</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── VersionSection ───────────────────────────────────────────────────────────

function VersionSection({
  version,
  canEdit,
  availableSemesters,
  onRefreshVersions,
}: {
  version: CurriculumVersion
  canEdit: boolean
  availableSemesters: number[]
  onRefreshVersions: () => void
}) {
  const queryClient = useQueryClient()
  const [isExpanded, setIsExpanded] = useState(false)
  const [filterSemester, setFilterSemester] = useState<string | undefined>(undefined)
  const [showEditVersion, setShowEditVersion] = useState(false)
  const [addEntryCtx, setAddEntryCtx] = useState<{ semester: number; nextOrder: number } | null>(null)
  const [editingEntry, setEditingEntry] = useState<CurriculumEntry | null>(null)

  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['curriculum-entries', version.id, filterSemester],
    queryFn: () =>
      curriculumApi.getEntries(version.id, filterSemester ? parseInt(filterSemester) : undefined),
    enabled: isExpanded,
  })

  const invalidateEntries = () =>
    void queryClient.invalidateQueries({ queryKey: ['curriculum-entries', version.id] })

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => curriculumApi.deleteEntry(id),
    onSuccess: invalidateEntries,
  })

  const deleteVersionMutation = useMutation({
    mutationFn: () => curriculumApi.deleteVersion(version.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['curriculum-versions-list'] })
      onRefreshVersions()
    },
  })

  const rawSemesters: SemesterEntries[] = entriesData?.data.data.semesters ?? []
  const semesters = rawSemesters.filter((s) => availableSemesters.includes(s.semester))
  const totalEntryCount = rawSemesters.reduce((n, s) => n + s.entries.length, 0)

  const spec = version.specialization
  const field = spec?.fieldOfStudy
  const faculty = field?.faculty

  return (
    <div className="mb-3 border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-card cursor-pointer hover:bg-muted/50 transition-colors select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">
              {spec?.shortName ?? '—'} — {spec?.name ?? '—'}
            </span>
            {field && (
              <Badge variant="outline" className="text-xs font-normal">{field.shortName}</Badge>
            )}
            {faculty && (
              <Badge variant="secondary" className="text-xs font-normal">{faculty.shortName}</Badge>
            )}
            {!version.isActive && (
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">nieaktywna</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {version.studyMode === 'FULL_TIME' ? 'Stacjonarne' : 'Niestacjonarne'}
            {' · '}
            {version.totalSemesters} semestrów
            {version._count !== undefined && (
              <> · {version._count.entries} przedmiotów</>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setShowEditVersion(true)}
            >
              <Pencil size={13} />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                  <Trash2 size={13} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Usuń siatkę godzin</AlertDialogTitle>
                  <AlertDialogDescription>
                    Czy na pewno chcesz usunąć siatkę godzin dla{' '}
                    <strong>{spec?.name} ({version.academicYear})</strong>?
                    Zostaną usunięte wszystkie wpisy ({totalEntryCount} przedmiotów).
                    Tej operacji nie można cofnąć.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Anuluj</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteVersionMutation.mutate()}
                  >
                    Usuń
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="px-4 py-4 border-t border-border bg-background">
          {/* Filtr semestru */}
          <div className="flex items-center gap-2 mb-4">
            <Select
              value={filterSemester ?? '__all_sem__'}
              onValueChange={(v) => setFilterSemester(v === '__all_sem__' ? undefined : v)}
            >
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all_sem__">Wszystkie semestry</SelectItem>
                {availableSemesters
                  .filter((s) => s <= version.totalSemesters)
                  .map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      Semestr {s}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {entriesLoading && (
            <div className="text-center py-8 text-muted-foreground text-sm">Ładowanie...</div>
          )}

          {!entriesLoading && semesters.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p className="mb-3">Brak wpisów</p>
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddEntryCtx({ semester: availableSemesters[0] ?? 1, nextOrder: 1 })}
                >
                  <Plus size={12} className="mr-1.5" />
                  Dodaj pierwszy przedmiot
                </Button>
              )}
            </div>
          )}

          {semesters.map((sem) => (
            <SemesterTable
              key={sem.semester}
              semester={sem.semester}
              entries={sem.entries}
              totalEcts={sem.totalEcts}
              canEdit={canEdit}
              onEditEntry={setEditingEntry}
              onDeleteEntry={(id, name) => {
                if (confirm(`Usunąć „${name}" z siatki?`)) deleteEntryMutation.mutate(id)
              }}
              onAddEntry={(semester, nextOrder) => setAddEntryCtx({ semester, nextOrder })}
            />
          ))}
        </div>
      )}

      {showEditVersion && (
        <EditVersionDialog
          version={version}
          onClose={() => setShowEditVersion(false)}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ['curriculum-versions-list'] })
            onRefreshVersions()
          }}
        />
      )}
      {addEntryCtx && (
        <AddEntryDialog
          versionId={version.id}
          semester={addEntryCtx.semester}
          nextOrder={addEntryCtx.nextOrder}
          onClose={() => setAddEntryCtx(null)}
          onSaved={invalidateEntries}
        />
      )}
      {editingEntry && (
        <EditEntryDialog
          key={editingEntry.id}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={invalidateEntries}
        />
      )}
    </div>
  )
}

// ─── CurriculumPage ────────────────────────────────────────────────────────────

export function CurriculumPage() {
  const user = useAuthStore((s) => s.user)
  const canEdit = user?.role === 'ADMIN'
  const { academicYear, semesterType } = useAcademicYearStore()
  const availableSemesters = SEMESTER_TYPE_NUMBERS[semesterType]

  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('__all__')
  const [selectedFieldId, setSelectedFieldId] = useState<string | undefined>(undefined)
  const [selectedStudyMode, setSelectedStudyMode] = useState<string | undefined>(undefined)
  const [showCreateVersion, setShowCreateVersion] = useState(false)

  const { data: facultiesData } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => curriculumApi.getFaculties(),
  })

  const { data: fieldsData } = useQuery({
    queryKey: ['fields-of-study', selectedFacultyId],
    queryFn: () => curriculumApi.getFieldsOfStudy(
      selectedFacultyId === '__all__' ? undefined : selectedFacultyId
    ),
    enabled: selectedFacultyId !== '__all__',
  })

  const { data: versionsData, refetch: refetchVersions } = useQuery({
    queryKey: ['curriculum-versions-list'],
    queryFn: () => curriculumApi.getVersions(),
  })

  const faculties = facultiesData?.data.data ?? []
  const fields = fieldsData?.data.data ?? []
  const allVersions = versionsData?.data.data ?? []

  const filteredVersions = allVersions
    .filter((v) => v.academicYear === academicYear)
    .filter((v) =>
      selectedFacultyId === '__all__' ||
      v.specialization?.fieldOfStudy?.faculty?.id === selectedFacultyId
    )
    .filter((v) =>
      !selectedFieldId ||
      v.specialization?.fieldOfStudyId === selectedFieldId
    )
    .filter((v) =>
      !selectedStudyMode || v.studyMode === selectedStudyMode
    )

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Siatka godzin</h2>
          <p className="text-muted-foreground text-sm">Plan studiów wg semestrów</p>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setShowCreateVersion(true)}>
            <Plus size={14} className="mr-1.5" />
            Nowa siatka
          </Button>
        )}
      </div>

      {/* Filtry */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-card rounded-lg border border-border">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Wydział</label>
          <Select
            value={selectedFacultyId}
            onValueChange={(v) => {
              setSelectedFacultyId(v)
              setSelectedFieldId(undefined)
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Wszystkie wydziały</SelectItem>
              {faculties.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.shortName} — {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 min-w-48">
          <label className="text-xs font-medium text-muted-foreground">Kierunek</label>
          <Select
            value={selectedFieldId ?? '__all_field__'}
            onValueChange={(v) => setSelectedFieldId(v === '__all_field__' ? undefined : v)}
            disabled={selectedFacultyId === '__all__'}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all_field__">Wszystkie kierunki</SelectItem>
              {fields.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Tryb studiów</label>
          <Select
            value={selectedStudyMode ?? '__all_mode__'}
            onValueChange={(v) => setSelectedStudyMode(v === '__all_mode__' ? undefined : v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all_mode__">Wszystkie</SelectItem>
              <SelectItem value="FULL_TIME">Stacjonarne</SelectItem>
              <SelectItem value="PART_TIME">Niestacjonarne</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end ml-auto">
          <span className="text-xs text-muted-foreground pb-2">
            {filteredVersions.length} {filteredVersions.length === 1 ? 'siatka' : filteredVersions.length < 5 ? 'siatki' : 'siatek'}
          </span>
        </div>
      </div>

      {filteredVersions.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p>Brak siatek godzin dla wybranych filtrów</p>
          {canEdit && (
            <Button className="mt-4" variant="outline" onClick={() => setShowCreateVersion(true)}>
              <Plus size={14} className="mr-1.5" />
              Utwórz nową siatkę
            </Button>
          )}
        </div>
      )}

      {filteredVersions.map((version) => (
        <VersionSection
          key={version.id}
          version={version}
          canEdit={canEdit}
          availableSemesters={availableSemesters}
          onRefreshVersions={refetchVersions}
        />
      ))}

      {showCreateVersion && (
        <CreateVersionDialog
          defaultAcademicYear={academicYear}
          onClose={() => setShowCreateVersion(false)}
          onCreated={() => refetchVersions()}
        />
      )}
    </div>
  )
}
