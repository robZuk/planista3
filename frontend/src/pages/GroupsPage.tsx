import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Users, Trash2 } from 'lucide-react'
import { groupsApi } from '@/api/groups'
import { curriculumApi } from '@/api/curriculum'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
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
  LECTURE: 'bg-blue-100 text-blue-800',
  EXERCISE: 'bg-green-100 text-green-800',
  LAB: 'bg-orange-100 text-orange-800',
  PROJECT: 'bg-purple-100 text-purple-800',
  SEMINAR: 'bg-pink-100 text-pink-800',
}

function GroupTree({ group }: { group: StudentGroup }) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = (group.subGroups?.length ?? 0) > 0

  return (
    <div>
      <div className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded-md group">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-5 h-5 flex items-center justify-center text-gray-400"
        >
          {hasChildren && (
            <ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
          )}
        </button>
        <Users size={14} className="text-gray-400" />
        <span className="font-medium text-sm">{group.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[group.type]}`}>
          {TYPE_LABELS[group.type]}
        </span>
        <span className="text-xs text-gray-400 ml-auto">{group.size} os.</span>
        <span className="text-xs text-gray-400">sem. {group.semester}</span>
      </div>
      {expanded && hasChildren && (
        <div className="ml-6 border-l border-gray-200 pl-2">
          {group.subGroups?.map((sub) => <GroupTree key={sub.id} group={sub} />)}
        </div>
      )}
    </div>
  )
}

function GenerateForm({
  onProposal,
}: {
  onProposal: (data: { proposal: GroupProposalItem[]; fieldOfStudyId: string; studyYear: number; semester: number; academicYear: string }) => void
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
          <div className="space-y-1">
            <Label>Kierunek</Label>
            <Select value={fieldOfStudyId} onChange={(e) => setFieldOfStudyId(e.target.value)}>
              <option value="">Wybierz kierunek</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.shortName}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Rok studiów</Label>
            <Select value={studyYear} onChange={(e) => setStudyYear(e.target.value)}>
              {[1, 2, 3, 4].map((y) => (
                <option key={y} value={String(y)}>
                  Rok {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Semestr</Label>
            <Select value={semester} onChange={(e) => setSemester(e.target.value)}>
              {Array.from({ length: 7 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  Semestr {i + 1}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Rok akademicki</Label>
            <Select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
              <option value="2024/2025">2024/2025</option>
              <option value="2023/2024">2023/2024</option>
            </Select>
          </div>
          <div className="space-y-1 col-span-2">
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
          <p className="text-sm text-red-600">Błąd generowania grup</p>
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
        <CardTitle>Propozycja grup ({proposal.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          {proposal.map((g) => (
            <div key={g.name} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-md">
              <span className="font-medium text-sm w-28">{g.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[g.type]}`}>
                {TYPE_LABELS[g.type]}
              </span>
              <span className="text-xs text-gray-500">{g.size} os.</span>
              {g.suggestedRoom && (
                <span className="text-xs text-gray-400 ml-auto">
                  sala {g.suggestedRoom.number} ({g.suggestedRoom.capacity} miejsc)
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
          <p className="text-sm text-red-600 mt-2">Błąd zapisu — grupy mogą już istnieć</p>
        )}
      </CardContent>
    </Card>
  )
}

export function GroupsPage() {
  const queryClient = useQueryClient()
  const [filterSemester, setFilterSemester] = useState('')
  const [proposal, setProposal] = useState<GroupProposalItem[] | null>(null)
  const [proposalMeta, setProposalMeta] = useState<{
    fieldOfStudyId: string; studyYear: number; semester: number; academicYear: string
  } | null>(null)

  const { data: groupsData, isLoading } = useQuery({
    queryKey: ['groups', filterSemester],
    queryFn: () => groupsApi.getAll({ semester: filterSemester ? parseInt(filterSemester) : undefined }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => groupsApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['groups'] }),
  })

  const groups = groupsData?.data.data ?? []
  const topLevelGroups = groups.filter((g) => !g.parentGroupId)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Grupy studentów</h2>
        <p className="text-gray-500 text-sm">Zarządzanie grupami i hierarchią</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel generowania / propozycji */}
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
              onCancel={() => {
                setProposal(null)
                setProposalMeta(null)
              }}
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

        {/* Lista grup */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <Select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="w-40"
            >
              <option value="">Wszystkie semestry</option>
              {Array.from({ length: 7 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  Semestr {i + 1}
                </option>
              ))}
            </Select>
            <Badge variant="secondary">{groups.length} grup</Badge>
          </div>

          {isLoading && <p className="text-gray-400">Ładowanie...</p>}

          {!isLoading && groups.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Users className="mx-auto mb-2" size={32} />
              <p>Brak grup. Wygeneruj pierwszą propozycję.</p>
            </div>
          )}

          {!isLoading && topLevelGroups.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-1">
                  {topLevelGroups.map((g) => (
                    <div key={g.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <GroupTree group={g} />
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Usunąć grupę ${g.name}?`)) deleteMutation.mutate(g.id)
                        }}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
