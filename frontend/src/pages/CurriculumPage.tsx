import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { curriculumApi } from '@/api/curriculum'
import { useAuthStore } from '@/store/authStore'
import { useAcademicYearStore } from '@/store/academicYearStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { CurriculumEntry, SemesterEntries } from '@/types'

const ASSESSMENT_LABELS: Record<string, string> = {
  EXAM: 'Egzamin',
  CREDIT: 'Zaliczenie',
}

function EditableHours({ value, onSave }: { value: number; onSave: (val: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(value))

  const commit = () => {
    const n = parseInt(val)
    if (!isNaN(n) && n >= 0) onSave(n)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          className="w-14 h-7 text-center text-xs px-1"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          autoFocus
        />
        <button onClick={commit} className="text-green-600 hover:text-green-700">
          <Check size={14} />
        </button>
        <button onClick={() => setEditing(false)} className="text-red-500 hover:text-red-600">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <span className="cursor-pointer hover:text-blue-600 hover:underline" onClick={() => setEditing(true)}>
      {value}
    </span>
  )
}

function SemesterTable({
  semester,
  entries,
  totalEcts,
  canEdit,
  onUpdateEntry,
}: {
  semester: number
  entries: CurriculumEntry[]
  totalEcts: number
  canEdit: boolean
  onUpdateEntry: (id: string, field: string, value: number) => void
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-base font-semibold text-foreground">Semestr {semester}</h3>
        <Badge variant="secondary">{totalEcts} ECTS</Badge>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry, idx) => (
              <tr key={entry.id} className="hover:bg-muted/50">
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
                {(['hoursLecture', 'hoursExercise', 'hoursLab', 'hoursProject', 'hoursSeminar'] as const).map(
                  (field) => (
                    <td key={field} className="px-2 py-2 text-center">
                      {canEdit ? (
                        <EditableHours value={entry[field]} onSave={(val) => onUpdateEntry(entry.id, field, val)} />
                      ) : (
                        entry[field]
                      )}
                    </td>
                  )
                )}
                <td className="px-2 py-2 text-center font-medium">{entry.totalHours}</td>
                <td className="px-2 py-2 text-center">
                  {canEdit ? (
                    <EditableHours value={entry.ects} onSave={(val) => onUpdateEntry(entry.id, 'ects', val)} />
                  ) : (
                    entry.ects
                  )}
                </td>
                <td className="px-2 py-2 text-center text-xs text-muted-foreground hidden lg:table-cell">
                  {ASSESSMENT_LABELS[entry.assessmentType]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function CurriculumPage() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const canEdit = user?.role === 'ADMIN'
  const { academicYear } = useAcademicYearStore()

  const [selectedFacultyId, setSelectedFacultyId] = useState('')
  const [selectedFieldId, setSelectedFieldId] = useState('')
  const [selectedStudyMode, setSelectedStudyMode] = useState('')
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [filterSemester, setFilterSemester] = useState('')

  const { data: facultiesData } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => curriculumApi.getFaculties(),
  })

  const { data: fieldsData } = useQuery({
    queryKey: ['fields-of-study', selectedFacultyId],
    queryFn: () => curriculumApi.getFieldsOfStudy(selectedFacultyId || undefined),
    enabled: !!selectedFacultyId,
  })

  const { data: specsData } = useQuery({
    queryKey: ['specializations', selectedFieldId],
    queryFn: () => curriculumApi.getSpecializations(selectedFieldId || undefined),
    enabled: !!selectedFieldId,
  })

  const { data: versionsData } = useQuery({
    queryKey: ['curriculum-versions-list'],
    queryFn: () => curriculumApi.getVersions(),
  })

  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['curriculum-entries', selectedVersionId, filterSemester],
    queryFn: () =>
      curriculumApi.getEntries(selectedVersionId, filterSemester ? parseInt(filterSemester) : undefined),
    enabled: !!selectedVersionId,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, field, value }: { id: string; field: string; value: number }) =>
      curriculumApi.updateEntry(id, { [field]: value }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['curriculum-entries'] }),
  })

  const faculties = facultiesData?.data.data ?? []
  const fields = fieldsData?.data.data ?? []
  const specs = specsData?.data.data ?? []
  const versions = versionsData?.data.data ?? []
  const semesters: SemesterEntries[] = entriesData?.data.data.semesters ?? []

  const currentVersion = versions.find((v) => v.id === selectedVersionId)
  const totalSemesters = currentVersion?.totalSemesters ?? 7

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Siatka godzin</h2>
        <p className="text-muted-foreground text-sm">Plan studiów wg semestrów</p>
      </div>

      {/* Filtry */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-card rounded-lg border border-border">
        <div className="flex flex-col gap-1 min-w-40">
          <label className="text-xs font-medium text-muted-foreground">Wydział</label>
          <Select
            value={selectedFacultyId || undefined}
            onValueChange={(v) => {
              setSelectedFacultyId(v)
              setSelectedFieldId('')
              setSelectedStudyMode('')
              setSelectedVersionId('')
              setFilterSemester('')
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Wybierz wydział" />
            </SelectTrigger>
            <SelectContent>
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
            value={selectedFieldId || undefined}
            onValueChange={(v) => {
              setSelectedFieldId(v)
              setSelectedStudyMode('')
              setSelectedVersionId('')
              setFilterSemester('')
            }}
            disabled={!selectedFacultyId}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Wybierz kierunek" />
            </SelectTrigger>
            <SelectContent>
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
            value={selectedStudyMode || undefined}
            onValueChange={(v) => { setSelectedStudyMode(v); setSelectedVersionId(''); setFilterSemester('') }}
            disabled={!selectedFieldId}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Wszystkie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FULL_TIME">Stacjonarne</SelectItem>
              <SelectItem value="PART_TIME">Niestacjonarne</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 min-w-48">
          <label className="text-xs font-medium text-muted-foreground">Specjalność</label>
          <Select
            value={selectedVersionId || undefined}
            onValueChange={(v) => { setSelectedVersionId(v); setFilterSemester('') }}
            disabled={!selectedFieldId}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Wybierz specjalność" />
            </SelectTrigger>
            <SelectContent>
              {(specs.length > 0
                ? versions.filter((v) => specs.some((s) => s.id === v.specialization?.id))
                : versions
              ).filter((v) => v.academicYear === academicYear)
               .filter((v) => !selectedStudyMode || v.studyMode === selectedStudyMode)
               .map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.specialization?.shortName ?? v.specialization?.name ?? '—'} · {v.academicYear}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedVersionId && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Semestr</label>
            <Select value={filterSemester || undefined} onValueChange={setFilterSemester}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Wszystkie" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: totalSemesters }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    Semestr {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!selectedVersionId && (
        <div className="text-center py-16 text-muted-foreground">
          <p>Wybierz plan studiów, aby wyświetlić siatkę godzin</p>
        </div>
      )}

      {selectedVersionId && entriesLoading && (
        <div className="text-center py-16 text-muted-foreground">Ładowanie...</div>
      )}

      {selectedVersionId && !entriesLoading && semesters.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">Brak wpisów dla wybranego planu</div>
      )}

      {semesters.map((sem) => (
        <SemesterTable
          key={sem.semester}
          semester={sem.semester}
          entries={sem.entries}
          totalEcts={sem.totalEcts}
          canEdit={canEdit}
          onUpdateEntry={(id, field, value) => updateMutation.mutate({ id, field, value })}
        />
      ))}
    </div>
  )
}
