import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Users } from 'lucide-react'
import { groupsApi } from '@/api/groups'
import { curriculumApi } from '@/api/curriculum'
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

function GroupTree({ group }: { group: StudentGroup }) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = (group.subGroups?.length ?? 0) > 0

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-md">
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
      </div>
      {expanded && hasChildren && (
        <div className="ml-5 border-l border-border pl-2">
          {group.subGroups?.map((sub) => <GroupTree key={sub.id} group={sub} />)}
        </div>
      )}
    </div>
  )
}

function GenerateForm({
  onProposal,
}: {
  onProposal: (data: {
    proposal: GroupProposalItem[]
    fieldOfStudyId: string
    studyYear: number
    semester: number
    academicYear: string
  }) => void
}) {
  const [fieldOfStudyId, setFieldOfStudyId] = useState('')
  const [studyYear, setStudyYear] = useState('1')
  const [semester, setSemester] = useState('1')
  const [academicYear, setAcademicYear] = useState('2024/2025')
  const [totalStudents, setTotalStudents] = useState('60')

  const { data: fieldsData } = useQuery({
    queryKey: ['fields-for-groups'],
    queryFn: () => curriculumApi.getFieldsOfStudy(),
  })

  const generateMutation = useMutation({
    mutationFn: () =>
      groupsApi.generate({
        fieldOfStudyId,
        studyYear: parseInt(studyYear),
        semester: parseInt(semester),
        academicYear,
        totalStudents: parseInt(totalStudents),
      }),
    onSuccess: (res) => {
      onProposal({
        proposal: res.data.data.proposal,
        fieldOfStudyId,
        studyYear: parseInt(studyYear),
        semester: parseInt(semester),
        academicYear,
      })
    },
  })

  const fields = fieldsData?.data.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generuj grupy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Kierunek</Label>
            <Select value={fieldOfStudyId || undefined} onValueChange={setFieldOfStudyId}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz kierunek" />
              </SelectTrigger>
              <SelectContent>
                {fields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.shortName} — {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Rok studiów</Label>
            <Select value={studyYear} onValueChange={setStudyYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((y) => (
                  <SelectItem key={y} value={String(y)}>Rok {y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Semestr</Label>
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 7 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>Semestr {i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Rok akademicki</Label>
            <Select value={academicYear} onValueChange={setAcademicYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2024/2025">2024/2025</SelectItem>
                <SelectItem value="2023/2024">2023/2024</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Liczba studentów</Label>
            <Input
              type="number"
              min={1}
              value={totalStudents}
              onChange={(e) => setTotalStudents(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="w-full"
          disabled={!fieldOfStudyId || generateMutation.isPending}
          onClick={() => generateMutation.mutate()}
        >
          {generateMutation.isPending ? 'Generowanie...' : 'Generuj propozycję'}
        </Button>
        {generateMutation.isError && (
          <p className="text-sm text-destructive">Błąd generowania grup</p>
        )}
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
  meta: { fieldOfStudyId: string; studyYear: number; semester: number; academicYear: string }
  onConfirm: () => void
  onCancel: () => void
}) {
  const confirmMutation = useMutation({
    mutationFn: () =>
      groupsApi.confirm({
        fieldOfStudyId: meta.fieldOfStudyId,
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
              <span className="text-xs text-muted-foreground">{g.size} os.</span>
              {g.suggestedRoom && (
                <span className="text-xs text-muted-foreground ml-auto">
                  sala {g.suggestedRoom.number}
                </span>
              )}
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
  const queryClient = useQueryClient()
  const [filterSemester, setFilterSemester] = useState<string>('')
  const [proposal, setProposal] = useState<GroupProposalItem[] | null>(null)
  const [proposalMeta, setProposalMeta] = useState<{
    fieldOfStudyId: string; studyYear: number; semester: number; academicYear: string
  } | null>(null)

  const { data: groupsData, isLoading } = useQuery({
    queryKey: ['groups', filterSemester],
    queryFn: () => groupsApi.getAll({ semester: filterSemester ? parseInt(filterSemester) : undefined }),
  })

  const groups = groupsData?.data.data ?? []
  const topLevelGroups = groups.filter((g) => !g.parentGroupId)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Grupy studentów</h2>
        <p className="text-muted-foreground text-sm">Zarządzanie grupami i hierarchią</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div>
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

        <div className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <Select value={filterSemester || undefined} onValueChange={setFilterSemester}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Wszystkie semestry" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 7 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    Semestr {i + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary">{groups.length} grup</Badge>
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
                  <GroupTree key={g.id} group={g} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
