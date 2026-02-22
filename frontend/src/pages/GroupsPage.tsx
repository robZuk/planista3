import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Users, Pencil, Trash2 } from 'lucide-react'
import { groupsApi } from '@/api/groups'
import { curriculumApi } from '@/api/curriculum'
import { useAuthStore } from '@/store/authStore'
import { useAcademicYearStore, SEMESTER_TYPE_NUMBERS } from '@/store/academicYearStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { StudentGroup, GroupProposalItem, GroupType } from '@/types'

const TYPE_LABELS: Record<GroupType, string> = {
  LECTURE: 'Wykład',
  EXERCISE: 'Ćwiczenia',
  LAB: 'Lab',
  PROJECT: 'Projekt',
  SEMINAR: 'Seminarium',
}

const TYPE_COLORS: Record<GroupType, string> = {
  LECTURE:  'bg-blue-500/15   text-blue-700   dark:bg-blue-500/20   dark:text-blue-300',
  EXERCISE: 'bg-green-500/15  text-green-700  dark:bg-green-500/20  dark:text-green-300',
  LAB:      'bg-orange-500/15 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  PROJECT:  'bg-purple-500/15 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  SEMINAR:  'bg-pink-500/15   text-pink-700   dark:bg-pink-500/20   dark:text-pink-300',
}

function EditGroupDialog({
  group,
  onClose,
  onSave,
}: {
  group: StudentGroup
  onClose: () => void
  onSave: (name: string, size: number) => void
}) {
  const [name, setName] = useState(group.name)
  const [size, setSize] = useState(String(group.size))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edytuj grupę</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Nazwa grupy</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Liczba studentów</Label>
            <Input type="number" min={1} value={size} onChange={(e) => setSize(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              disabled={!name.trim() || !size}
              onClick={() => onSave(name.trim(), parseInt(size))}
            >
              Zapisz
            </Button>
            <Button variant="outline" onClick={onClose}>Anuluj</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GroupTree({
  group,
  canEdit,
  onEdit,
  onDelete,
}: {
  group: StudentGroup
  canEdit: boolean
  onEdit: (g: StudentGroup) => void
  onDelete: (g: StudentGroup) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = (group.subGroups?.length ?? 0) > 0

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-md cursor-pointer group">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-4 h-4 flex items-center justify-center text-muted-foreground"
        >
          {hasChildren && (
            <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          )}
        </button>
        <Users size={13} className="text-muted-foreground" />
        <span className="font-medium text-sm">{group.name}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${TYPE_COLORS[group.type]}`}>
          {TYPE_LABELS[group.type]}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">{group.size} os. · sem. {group.semester}</span>
        {canEdit && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(group)}>
              <Pencil size={11} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={() => onDelete(group)}
            >
              <Trash2 size={11} />
            </Button>
          </div>
        )}
      </div>
      {expanded && hasChildren && (
        <div className="ml-5 border-l border-border pl-2">
          {group.subGroups?.map((sub) => (
            <GroupTree key={sub.id} group={sub} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

const STUDY_MODE_LABELS: Record<string, string> = {
  FULL_TIME: 'Stacjonarne',
  PART_TIME: 'Niestacjonarne',
}

function GenerateForm({
  onProposal,
}: {
  onProposal: (data: {
    proposal: GroupProposalItem[]
    fieldOfStudyId: string
    specializationId: string
    studyYear: number
    semester: number
    academicYear: string
  }) => void
}) {
  const { academicYear, semesterType } = useAcademicYearStore()
  const semesterTypeNumbers = SEMESTER_TYPE_NUMBERS[semesterType]

  const [facultyId, setFacultyId] = useState('')
  const [fieldOfStudyId, setFieldOfStudyId] = useState('')
  const [specializationId, setSpecializationId] = useState('')
  const [studyMode, setStudyMode] = useState('')
  const [semester, setSemester] = useState('')
  const [totalStudents, setTotalStudents] = useState('60')

  // Kaskada: wydział → kierunek → specjalność
  const { data: facultiesData } = useQuery({
    queryKey: ['faculties-for-groups'],
    queryFn: () => curriculumApi.getFaculties(),
  })
  const { data: fieldsData } = useQuery({
    queryKey: ['fields-for-groups', facultyId],
    queryFn: () => curriculumApi.getFieldsOfStudy(facultyId),
    enabled: !!facultyId,
  })
  const { data: specsData } = useQuery({
    queryKey: ['specs-for-groups', fieldOfStudyId],
    queryFn: () => curriculumApi.getSpecializations(fieldOfStudyId),
    enabled: !!fieldOfStudyId,
  })

  // Wersje planu — filtrowane po specjalności lub kierunku gdy brak specjalności
  const specChosen = specializationId !== ''  // '' = nie wybrany, 'none' lub ID = wybrany
  const { data: versionsData } = useQuery({
    queryKey: ['versions-for-groups', specializationId, fieldOfStudyId, academicYear],
    queryFn: () => curriculumApi.getVersions(),
    enabled: specChosen,
    select: (res) =>
      res.data.data.filter((v) => {
        if (!v.academicYear || v.academicYear !== academicYear) return false
        if (specializationId === 'none') return v.specialization?.fieldOfStudyId === fieldOfStudyId
        return v.specialization?.id === specializationId
      }),
  })

  // Wpisy siatki dla wybranej wersji → które semestry mają dane
  const selectedVersion = versionsData?.find((v) => v.studyMode === studyMode)
  const { data: entriesData } = useQuery({
    queryKey: ['entries-for-groups', selectedVersion?.id],
    queryFn: () => curriculumApi.getEntries(selectedVersion!.id),
    enabled: !!selectedVersion?.id,
    select: (res) => res.data.data.semesters.map((s) => s.semester),
  })

  const faculties = facultiesData?.data.data ?? []
  const fields = fieldsData?.data.data ?? []
  const specs = specsData?.data.data ?? []
  const availableStudyModes = [...new Set(versionsData?.map((v) => v.studyMode) ?? [])]
  // Semestry: mają wpisy w siatce ORAZ pasują do zimowy/letni
  const availableSemesters = (entriesData ?? []).filter((s) => semesterTypeNumbers.includes(s))
  // Rok studiów wynikający z semestru
  const studyYear = semester ? Math.ceil(parseInt(semester) / 2) : 1

  const generateMutation = useMutation({
    mutationFn: () =>
      groupsApi.generate({
        fieldOfStudyId,
        specializationId: specializationId === 'none' ? undefined : specializationId || undefined,
        studyYear,
        semester: parseInt(semester),
        academicYear,
        totalStudents: parseInt(totalStudents),
      }),
    onSuccess: (res) => {
      onProposal({
        proposal: res.data.data.proposal,
        fieldOfStudyId,
        specializationId: specializationId === 'none' ? '' : specializationId,
        studyYear,
        semester: parseInt(semester),
        academicYear,
      })
    },
  })

  const canGenerate = !!fieldOfStudyId && specChosen && !!studyMode && !!semester && !generateMutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generuj grupy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <div className="space-y-1.5 min-w-0">
            <Label>Wydział</Label>
            <Select value={facultyId || undefined} onValueChange={(v) => { setFacultyId(v); setFieldOfStudyId(''); setSpecializationId(''); setStudyMode(''); setSemester('') }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Wybierz wydział" /></SelectTrigger>
              <SelectContent>
                {faculties.map((f) => <SelectItem key={f.id} value={f.id}>{f.shortName} — {f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label>Kierunek</Label>
            <Select value={fieldOfStudyId || undefined} onValueChange={(v) => { setFieldOfStudyId(v); setSpecializationId(''); setStudyMode(''); setSemester('') }} disabled={!facultyId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Wybierz kierunek" /></SelectTrigger>
              <SelectContent>
                {fields.map((f) => <SelectItem key={f.id} value={f.id}>{f.shortName} — {f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label>Specjalność</Label>
            <Select value={specializationId || undefined} onValueChange={(v) => { setSpecializationId(v); setStudyMode(''); setSemester('') }} disabled={!fieldOfStudyId}>
              <SelectTrigger className="w-full"><SelectValue placeholder={!fieldOfStudyId ? 'Najpierw wybierz kierunek' : 'Wybierz specjalność'} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Brak (ogólnie dla kierunku)</SelectItem>
                {specs.map((s) => <SelectItem key={s.id} value={s.id}>{s.shortName} — {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label>Tryb studiów</Label>
            <Select value={studyMode || undefined} onValueChange={(v) => { setStudyMode(v); setSemester('') }} disabled={!specChosen || availableStudyModes.length === 0}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={
                  !specChosen ? 'Najpierw wybierz specjalność'
                  : availableStudyModes.length === 0 ? 'Brak planów studiów'
                  : 'Wybierz tryb'
                } />
              </SelectTrigger>
              <SelectContent>
                {availableStudyModes.map((m) => (
                  <SelectItem key={m} value={m}>{STUDY_MODE_LABELS[m] ?? m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label>Semestr</Label>
            <Select value={semester || undefined} onValueChange={setSemester} disabled={!studyMode || availableSemesters.length === 0}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={
                  !studyMode ? 'Najpierw wybierz tryb'
                  : availableSemesters.length === 0 ? 'Brak semestrów w siatce'
                  : 'Wybierz semestr'
                } />
              </SelectTrigger>
              <SelectContent>
                {availableSemesters.map((s) => (
                  <SelectItem key={s} value={String(s)}>Semestr {s} (rok {Math.ceil(s / 2)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0">
            <Label>Liczba studentów</Label>
            <Input type="number" min={1} value={totalStudents} onChange={(e) => setTotalStudents(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button disabled={!canGenerate} onClick={() => generateMutation.mutate()}>
            {generateMutation.isPending ? 'Generowanie...' : 'Generuj propozycję'}
          </Button>
          {generateMutation.isError && (
            <p className="text-sm text-destructive">Błąd generowania grup</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ProposalPreview({
  proposal,
  meta,
  onConfirm,
  onCancel,
}: {
  proposal: GroupProposalItem[]
  meta: { fieldOfStudyId: string; specializationId: string; studyYear: number; semester: number; academicYear: string }
  onConfirm: () => void
  onCancel: () => void
}) {
  const confirmMutation = useMutation({
    mutationFn: () =>
      groupsApi.confirm({
        fieldOfStudyId: meta.fieldOfStudyId,
        specializationId: meta.specializationId || undefined,
        studyYear: meta.studyYear,
        semester: meta.semester,
        academicYear: meta.academicYear,
        proposal,
      }),
    onSuccess: onConfirm,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Propozycja ({proposal.length} grup)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 mb-4 max-h-80 overflow-y-auto">
          {proposal.map((g) => (
            <div key={g.name} className="flex items-center gap-2 py-1.5 px-2 bg-muted/50 rounded-md">
              <span className="font-medium text-sm w-28 shrink-0">{g.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${TYPE_COLORS[g.type]}`}>
                {TYPE_LABELS[g.type]}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">{g.size} os.</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={confirmMutation.isPending}
            onClick={() => confirmMutation.mutate()}
          >
            {confirmMutation.isPending ? 'Zapisywanie...' : 'Zatwierdź i zapisz'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Anuluj
          </Button>
        </div>
        {confirmMutation.isError && (
          <p className="text-sm text-destructive mt-2">Błąd — grupy mogą już istnieć</p>
        )}
      </CardContent>
    </Card>
  )
}

export function GroupsPage() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const canEdit = user?.role === 'ADMIN'
  const { academicYear, semesterType } = useAcademicYearStore()
  const availableSemesters = SEMESTER_TYPE_NUMBERS[semesterType]

  const [filterSemester, setFilterSemester] = useState<string>('')
  const [proposal, setProposal] = useState<GroupProposalItem[] | null>(null)
  const [proposalMeta, setProposalMeta] = useState<{
    fieldOfStudyId: string; specializationId: string; studyYear: number; semester: number; academicYear: string
  } | null>(null)
  const [editingGroup, setEditingGroup] = useState<StudentGroup | null>(null)

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['groups'] })

  const updateMutation = useMutation({
    mutationFn: ({ id, name, size }: { id: string; name: string; size: number }) =>
      groupsApi.update(id, { name, size }),
    onSuccess: () => { invalidate(); setEditingGroup(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => groupsApi.remove(id),
    onSuccess: invalidate,
  })

  const deleteAllMutation = useMutation({
    mutationFn: () => groupsApi.removeAll(academicYear),
    onSuccess: invalidate,
  })

  const { data: groupsData, isLoading } = useQuery({
    queryKey: ['groups', filterSemester, academicYear],
    queryFn: () => groupsApi.getAll({ semester: filterSemester ? parseInt(filterSemester) : undefined, academicYear }),
  })

  const groups = groupsData?.data.data ?? []
  const topLevelGroups = groups.filter((g) => !g.parentGroupId)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Grupy studentów</h2>
        <p className="text-muted-foreground text-sm">Zarządzanie grupami i hierarchią</p>
      </div>

      {/* Sekcja 1: Generowanie */}
      <div className="mb-6">
        {proposal && proposalMeta ? (
          <ProposalPreview
            proposal={proposal}
            meta={proposalMeta}
            onConfirm={() => {
              setProposal(null)
              setProposalMeta(null)
              void queryClient.invalidateQueries({ queryKey: ['groups'] })
            }}
            onCancel={() => { setProposal(null); setProposalMeta(null) }}
          />
        ) : (
          <GenerateForm
            onProposal={({ proposal, ...meta }) => {
              setProposal(proposal)
              setProposalMeta(meta)
            }}
          />
        )}
      </div>

      {/* Sekcja 2: Lista grup */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Select value={filterSemester || undefined} onValueChange={setFilterSemester}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Wszystkie semestry" />
            </SelectTrigger>
            <SelectContent>
              {availableSemesters.map((s) => (
                <SelectItem key={s} value={String(s)}>Semestr {s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{groups.length} grup</Badge>
          {canEdit && groups.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="ml-auto"
              disabled={deleteAllMutation.isPending}
              onClick={() => {
                if (confirm(`Usunąć wszystkie grupy (${academicYear})?`))
                  deleteAllMutation.mutate()
              }}
            >
              <Trash2 size={14} className="mr-1" />
              Usuń wszystkie
            </Button>
          )}
        </div>

        {isLoading && <p className="text-muted-foreground">Ładowanie...</p>}

        {!isLoading && groups.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="mx-auto mb-2" size={32} />
            <p>Brak grup. Wygeneruj pierwszą propozycję.</p>
          </div>
        )}

        {!isLoading && topLevelGroups.length > 0 && (
          <Card>
            <CardContent className="pt-2">
              {topLevelGroups.map((g) => (
                <GroupTree
                  key={g.id}
                  group={g}
                  canEdit={canEdit}
                  onEdit={setEditingGroup}
                  onDelete={(g) => {
                    if (confirm(`Usunąć grupę „${g.name}"?`)) deleteMutation.mutate(g.id)
                  }}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {editingGroup && (
          <EditGroupDialog
            key={editingGroup.id}
            group={editingGroup}
            onClose={() => setEditingGroup(null)}
            onSave={(name, size) => updateMutation.mutate({ id: editingGroup.id, name, size })}
          />
        )}
      </div>
    </div>
  )
}
