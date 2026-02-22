import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown, GraduationCap, BookOpen, Layers } from 'lucide-react'
import { facultiesApi, fieldsApi, specsApi } from '@/api/faculties'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Faculty, FieldOfStudy, Specialization } from '@/types'

// ─── Typy lokalne ─────────────────────────────────────────────

type DialogState =
  | { type: 'faculty'; item: Faculty | null }
  | { type: 'field'; item: FieldOfStudy | null; facultyId: string }
  | { type: 'spec'; item: Specialization | null; fieldOfStudyId: string }
  | null

// ─── Generyczny dialog nazwy ──────────────────────────────────

function NameDialog({
  open,
  title,
  name,
  shortName,
  onClose,
  onSave,
}: {
  open: boolean
  title: string
  name: string
  shortName: string
  onClose: () => void
  onSave: (name: string, shortName: string) => void
}) {
  const [n, setN] = useState(name)
  const [s, setS] = useState(shortName)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Nazwa</Label>
            <Input value={n} onChange={(e) => setN(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Skrót</Label>
            <Input value={s} onChange={(e) => setS(e.target.value)} placeholder="np. WM, EDST" />
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" disabled={!n.trim() || !s.trim()} onClick={() => onSave(n.trim(), s.trim())}>
              Zapisz
            </Button>
            <Button variant="outline" onClick={onClose}>Anuluj</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Wiersz specjalności ──────────────────────────────────────

function SpecRow({
  spec,
  canEdit,
  onEdit,
  onDelete,
}: {
  spec: Specialization
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group">
      <Layers size={13} className="text-muted-foreground shrink-0" />
      <span className="text-sm flex-1">{spec.name}</span>
      <span className="text-xs text-muted-foreground">{spec.shortName}</span>
      {canEdit && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
            <Pencil size={11} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 size={11} />
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Wiersz kierunku ──────────────────────────────────────────

function FieldRow({
  field,
  specs,
  canEdit,
  onEdit,
  onDelete,
  onAddSpec,
  onEditSpec,
  onDeleteSpec,
}: {
  field: FieldOfStudy
  specs: Specialization[]
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onAddSpec: () => void
  onEditSpec: (s: Specialization) => void
  onDeleteSpec: (s: Specialization) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const fieldSpecs = specs.filter((s) => s.fieldOfStudyId === field.id)

  return (
    <div className="ml-5 border-l border-border pl-3">
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        {expanded
          ? <ChevronDown size={13} className="text-muted-foreground shrink-0" />
          : <ChevronRight size={13} className="text-muted-foreground shrink-0" />}
        <BookOpen size={13} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1">{field.name}</span>
        <span className="text-xs text-muted-foreground mr-1">{field.shortName}</span>
        <Badge variant="secondary" className="text-xs">{fieldSpecs.length}</Badge>
        {canEdit && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
              <Pencil size={11} />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 size={11} />
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="ml-5 border-l border-border pl-3 py-1">
          {fieldSpecs.length === 0 && (
            <p className="text-xs text-muted-foreground py-1 px-2">Brak specjalności</p>
          )}
          {fieldSpecs.map((s) => (
            <SpecRow
              key={s.id}
              spec={s}
              canEdit={canEdit}
              onEdit={() => onEditSpec(s)}
              onDelete={() => onDeleteSpec(s)}
            />
          ))}
          {canEdit && (
            <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs text-muted-foreground" onClick={onAddSpec}>
              <Plus size={11} className="mr-1" /> Dodaj specjalność
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Karta wydziału ───────────────────────────────────────────

function FacultyCard({
  faculty,
  fields,
  specs,
  canEdit,
  onEdit,
  onDelete,
  onAddField,
  onEditField,
  onDeleteField,
  onAddSpec,
  onEditSpec,
  onDeleteSpec,
}: {
  faculty: Faculty
  fields: FieldOfStudy[]
  specs: Specialization[]
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onAddField: () => void
  onEditField: (f: FieldOfStudy) => void
  onDeleteField: (f: FieldOfStudy) => void
  onAddSpec: (fieldId: string) => void
  onEditSpec: (s: Specialization) => void
  onDeleteSpec: (s: Specialization) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const facultyFields = fields.filter((f) => f.facultyId === faculty.id)

  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        {/* Nagłówek wydziału */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? <ChevronDown size={16} className="text-muted-foreground shrink-0" />
            : <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
          <GraduationCap size={16} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground leading-tight">{faculty.name}</p>
            <p className="text-xs text-muted-foreground">{faculty.shortName}</p>
          </div>
          <Badge variant="secondary">{facultyFields.length} kier.</Badge>
          {canEdit && (
            <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Pencil size={13} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 size={13} />
              </Button>
            </div>
          )}
        </div>

        {/* Rozwinięte kierunki */}
        {expanded && (
          <div className="mt-3">
            {facultyFields.length === 0 && (
              <p className="text-sm text-muted-foreground px-2 py-1">Brak kierunków</p>
            )}
            {facultyFields.map((f) => (
              <FieldRow
                key={f.id}
                field={f}
                specs={specs}
                canEdit={canEdit}
                onEdit={() => onEditField(f)}
                onDelete={() => onDeleteField(f)}
                onAddSpec={() => onAddSpec(f.id)}
                onEditSpec={onEditSpec}
                onDeleteSpec={onDeleteSpec}
              />
            ))}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-5 mt-2 h-7 text-xs text-muted-foreground"
                onClick={onAddField}
              >
                <Plus size={11} className="mr-1" /> Dodaj kierunek
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Strona ───────────────────────────────────────────────────

export function FacultiesPage() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const canEdit = user?.role === 'ADMIN'

  const [dialog, setDialog] = useState<DialogState>(null)

  const { data: facultiesData, isLoading: loadingF } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => facultiesApi.getAll(),
  })
  const { data: fieldsData, isLoading: loadingFi } = useQuery({
    queryKey: ['fields-of-study'],
    queryFn: () => fieldsApi.getAll(),
  })
  const { data: specsData, isLoading: loadingS } = useQuery({
    queryKey: ['specializations'],
    queryFn: () => specsApi.getAll(),
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['faculties'] })
    void queryClient.invalidateQueries({ queryKey: ['fields-of-study'] })
    void queryClient.invalidateQueries({ queryKey: ['specializations'] })
  }

  const createFaculty = useMutation({
    mutationFn: (d: { name: string; shortName: string }) => facultiesApi.create(d),
    onSuccess: () => { invalidate(); setDialog(null) },
  })
  const updateFaculty = useMutation({
    mutationFn: ({ id, ...d }: { id: string; name: string; shortName: string }) => facultiesApi.update(id, d),
    onSuccess: () => { invalidate(); setDialog(null) },
  })
  const deleteFaculty = useMutation({
    mutationFn: (id: string) => facultiesApi.remove(id),
    onSuccess: invalidate,
  })

  const createField = useMutation({
    mutationFn: (d: { name: string; shortName: string; facultyId: string }) => fieldsApi.create(d),
    onSuccess: () => { invalidate(); setDialog(null) },
  })
  const updateField = useMutation({
    mutationFn: ({ id, ...d }: { id: string; name: string; shortName: string }) => fieldsApi.update(id, d),
    onSuccess: () => { invalidate(); setDialog(null) },
  })
  const deleteField = useMutation({
    mutationFn: (id: string) => fieldsApi.remove(id),
    onSuccess: invalidate,
  })

  const createSpec = useMutation({
    mutationFn: (d: { name: string; shortName: string; fieldOfStudyId: string }) => specsApi.create(d),
    onSuccess: () => { invalidate(); setDialog(null) },
  })
  const updateSpec = useMutation({
    mutationFn: ({ id, ...d }: { id: string; name: string; shortName: string }) => specsApi.update(id, d),
    onSuccess: () => { invalidate(); setDialog(null) },
  })
  const deleteSpec = useMutation({
    mutationFn: (id: string) => specsApi.remove(id),
    onSuccess: invalidate,
  })

  const faculties = facultiesData?.data.data ?? []
  const fields = fieldsData?.data.data ?? []
  const specs = specsData?.data.data ?? []
  const isLoading = loadingF || loadingFi || loadingS

  // dialog title + current values
  const dialogTitle =
    dialog?.type === 'faculty' ? (dialog.item ? 'Edytuj wydział' : 'Dodaj wydział') :
    dialog?.type === 'field'   ? (dialog.item ? 'Edytuj kierunek' : 'Dodaj kierunek') :
    dialog?.type === 'spec'    ? (dialog.item ? 'Edytuj specjalność' : 'Dodaj specjalność') : ''

  const handleSave = (name: string, shortName: string) => {
    if (!dialog) return
    if (dialog.type === 'faculty') {
      if (dialog.item) updateFaculty.mutate({ id: dialog.item.id, name, shortName })
      else createFaculty.mutate({ name, shortName })
    } else if (dialog.type === 'field') {
      if (dialog.item) updateField.mutate({ id: dialog.item.id, name, shortName })
      else createField.mutate({ name, shortName, facultyId: dialog.facultyId })
    } else if (dialog.type === 'spec') {
      if (dialog.item) updateSpec.mutate({ id: dialog.item.id, name, shortName })
      else createSpec.mutate({ name, shortName, fieldOfStudyId: dialog.fieldOfStudyId })
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Wydziały i kierunki</h2>
          <p className="text-muted-foreground text-sm">Struktura organizacyjna uczelni</p>
        </div>
        {canEdit && (
          <Button onClick={() => setDialog({ type: 'faculty', item: null })}>
            <Plus size={16} className="mr-2" />
            Dodaj wydział
          </Button>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground text-center py-16">Ładowanie…</p>}

      {!isLoading && faculties.length === 0 && (
        <p className="text-muted-foreground text-center py-16">Brak wydziałów</p>
      )}

      {!isLoading && (
        <div className="space-y-3">
          {faculties.map((f) => (
            <FacultyCard
              key={f.id}
              faculty={f}
              fields={fields}
              specs={specs}
              canEdit={canEdit}
              onEdit={() => setDialog({ type: 'faculty', item: f })}
              onDelete={() => {
                if (confirm(`Usunąć wydział „${f.name}"?`)) deleteFaculty.mutate(f.id)
              }}
              onAddField={() => setDialog({ type: 'field', item: null, facultyId: f.id })}
              onEditField={(fi) => setDialog({ type: 'field', item: fi, facultyId: f.id })}
              onDeleteField={(fi) => {
                if (confirm(`Usunąć kierunek „${fi.name}"?`)) deleteField.mutate(fi.id)
              }}
              onAddSpec={(fieldId) => setDialog({ type: 'spec', item: null, fieldOfStudyId: fieldId })}
              onEditSpec={(s) => setDialog({ type: 'spec', item: s, fieldOfStudyId: s.fieldOfStudyId })}
              onDeleteSpec={(s) => {
                if (confirm(`Usunąć specjalność „${s.name}"?`)) deleteSpec.mutate(s.id)
              }}
            />
          ))}
        </div>
      )}

      <NameDialog
        key={dialog ? `${dialog.type}-${dialog.type === 'faculty' ? dialog.item?.id : dialog.type === 'field' ? dialog.item?.id : dialog.item?.id ?? 'new'}` : 'closed'}
        open={dialog !== null}
        title={dialogTitle}
        name={dialog?.item?.name ?? ''}
        shortName={dialog?.item?.shortName ?? ''}
        onClose={() => setDialog(null)}
        onSave={handleSave}
      />
    </div>
  )
}
