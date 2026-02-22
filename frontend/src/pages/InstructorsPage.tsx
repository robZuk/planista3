import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { instructorsApi } from '@/api/instructors'
import { curriculumApi } from '@/api/curriculum'
import { useAuthStore } from '@/store/authStore'
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
import { Card, CardContent } from '@/components/ui/card'
import type { Instructor } from '@/types'

const EMPTY_FORM = { firstName: '', lastName: '', email: '', title: '', facultyId: '' }

function InstructorDialog({
  open,
  instructor,
  faculties,
  onClose,
  onSave,
}: {
  open: boolean
  instructor: Instructor | null
  faculties: { id: string; name: string; shortName: string }[]
  onClose: () => void
  onSave: (data: typeof EMPTY_FORM) => void
}) {
  const [form, setForm] = useState(
    instructor
      ? {
          firstName: instructor.firstName,
          lastName: instructor.lastName,
          email: instructor.email,
          title: instructor.title ?? '',
          facultyId: instructor.facultyId ?? '',
        }
      : EMPTY_FORM
  )

  const set = (k: keyof typeof EMPTY_FORM) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{instructor ? 'Edytuj prowadzącego' : 'Dodaj prowadzącego'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Imię</Label>
              <Input value={form.firstName} onChange={(e) => set('firstName')(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Nazwisko</Label>
              <Input value={form.lastName} onChange={(e) => set('lastName')(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tytuł / stopień</Label>
            <Input placeholder="dr, dr inż., prof. dr hab. …" value={form.title} onChange={(e) => set('title')(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Wydział</Label>
            <Select value={form.facultyId || undefined} onValueChange={set('facultyId')}>
              <SelectTrigger>
                <SelectValue placeholder="— ogólnouczelniany —" />
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
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              disabled={!form.firstName || !form.lastName || !form.email}
              onClick={() => onSave(form)}
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

export function InstructorsPage() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const canEdit = user?.role === 'ADMIN'

  const [filterFacultyId, setFilterFacultyId] = useState('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Instructor | null>(null)

  const { data: facultiesData } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => curriculumApi.getFaculties(),
  })

  const { data: instructorsData, isLoading } = useQuery({
    queryKey: ['instructors', filterFacultyId],
    queryFn: () => instructorsApi.getAll(filterFacultyId || undefined),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      instructorsApi.create({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        title: data.title || undefined,
        facultyId: data.facultyId || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['instructors'] })
      setDialogOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof EMPTY_FORM }) =>
      instructorsApi.update(id, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        title: data.title || undefined,
        facultyId: data.facultyId || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['instructors'] })
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instructorsApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['instructors'] }),
  })

  const faculties = facultiesData?.data.data ?? []
  const all = instructorsData?.data.data ?? []
  const instructors = search
    ? all.filter(
        (i) =>
          i.lastName.toLowerCase().includes(search.toLowerCase()) ||
          i.firstName.toLowerCase().includes(search.toLowerCase()) ||
          i.email.toLowerCase().includes(search.toLowerCase())
      )
    : all

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Prowadzący</h2>
          <p className="text-muted-foreground text-sm">Lista pracowników dydaktycznych</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true) }}>
            <Plus size={16} className="mr-2" />
            Dodaj
          </Button>
        )}
      </div>

      {/* Filtry */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-card rounded-lg border border-border">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Wydział</label>
          <Select value={filterFacultyId || undefined} onValueChange={setFilterFacultyId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Wszystkie wydziały" />
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
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Szukaj</label>
          <Input
            className="w-56"
            placeholder="Nazwisko lub email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {filterFacultyId && (
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={() => setFilterFacultyId('')}>
              Wyczyść filtry
            </Button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground text-center py-16">Ładowanie…</p>}

      {!isLoading && instructors.length === 0 && (
        <p className="text-muted-foreground text-center py-16">Brak prowadzących</p>
      )}

      {!isLoading && instructors.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Prowadzący</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Wydział</th>
                    {canEdit && <th className="px-4 py-3 w-20" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {instructors.map((inst) => (
                    <tr key={inst.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {inst.title && (
                            <span className="text-muted-foreground font-normal mr-1">{inst.title}</span>
                          )}
                          {inst.firstName} {inst.lastName}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {inst.email}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {inst.faculty?.shortName ?? <span className="italic">ogólnouczelniany</span>}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => { setEditing(inst); setDialogOpen(true) }}
                            >
                              <Pencil size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`Usunąć ${inst.firstName} ${inst.lastName}?`))
                                  deleteMutation.mutate(inst.id)
                              }}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <InstructorDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        instructor={editing}
        faculties={faculties}
        onClose={() => { setDialogOpen(false); setEditing(null) }}
        onSave={(data) => {
          if (editing) {
            updateMutation.mutate({ id: editing.id, data })
          } else {
            createMutation.mutate(data)
          }
        }}
      />
    </div>
  )
}
