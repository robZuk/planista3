import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown, ChevronRight, Pencil, Trash2, Building2 } from 'lucide-react'
import { buildingsApi } from '@/api/buildings'
import { curriculumApi } from '@/api/curriculum'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Building, Room, RoomType } from '@/types'

// ─── Stałe ───────────────────────────────────────────────────

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  LECTURE:      'Wykładowa',
  EXERCISE:     'Ćwiczeniowa',
  LAB:          'Laboratorium',
  COMPUTER_LAB: 'Kom­puterowa',
  SEMINAR:      'Seminaryjna',
  SPORTS:       'Sportowa',
}

const ROOM_TYPE_COLORS: Record<RoomType, string> = {
  LECTURE:      'bg-blue-500/15   text-blue-700   dark:text-blue-300',
  EXERCISE:     'bg-green-500/15  text-green-700  dark:text-green-300',
  LAB:          'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  COMPUTER_LAB: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  SEMINAR:      'bg-pink-500/15   text-pink-700   dark:text-pink-300',
  SPORTS:       'bg-teal-500/15   text-teal-700   dark:text-teal-300',
}

const ROOM_TYPES: RoomType[] = ['LECTURE', 'EXERCISE', 'LAB', 'COMPUTER_LAB', 'SEMINAR', 'SPORTS']

// ─── Dialog budynku ───────────────────────────────────────────

const EMPTY_BUILDING = { name: '', address: '', facultyId: '' }

function BuildingDialog({
  open,
  building,
  faculties,
  onClose,
  onSave,
}: {
  open: boolean
  building: Building | null
  faculties: { id: string; name: string; shortName: string }[]
  onClose: () => void
  onSave: (data: typeof EMPTY_BUILDING) => void
}) {
  const [form, setForm] = useState(
    building
      ? { name: building.name, address: building.address ?? '', facultyId: building.facultyId ?? '' }
      : EMPTY_BUILDING
  )
  const set = (k: keyof typeof EMPTY_BUILDING) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{building ? 'Edytuj budynek' : 'Dodaj budynek'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Nazwa budynku</Label>
            <Input placeholder="Budynek A" value={form.name} onChange={(e) => set('name')(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Adres</Label>
            <Input placeholder="ul. Morska 81-87, Gdynia" value={form.address} onChange={(e) => set('address')(e.target.value)} />
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
            <Button className="flex-1" disabled={!form.name} onClick={() => onSave(form)}>
              Zapisz
            </Button>
            <Button variant="outline" onClick={onClose}>Anuluj</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Dialog sali ─────────────────────────────────────────────

const EMPTY_ROOM = { number: '', type: 'LECTURE' as RoomType, capacity: '30' }

function RoomDialog({
  open,
  room,
  onClose,
  onSave,
}: {
  open: boolean
  room: Room | null
  onClose: () => void
  onSave: (data: typeof EMPTY_ROOM) => void
}) {
  const [form, setForm] = useState(
    room
      ? { number: room.number, type: room.type, capacity: String(room.capacity) }
      : EMPTY_ROOM
  )

  useEffect(() => {
    setForm(room
      ? { number: room.number, type: room.type, capacity: String(room.capacity) }
      : EMPTY_ROOM
    )
  }, [room, open])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{room ? 'Edytuj salę' : 'Dodaj salę'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Numer / nazwa sali</Label>
            <Input placeholder="A101" value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Typ sali</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as RoomType }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{ROOM_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Pojemność (miejsca)</Label>
            <Input
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              disabled={!form.number || !form.capacity}
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

// ─── Karta budynku ────────────────────────────────────────────

function BuildingCard({
  building,
  canEdit,
  onEditBuilding,
  onDeleteBuilding,
  onAddRoom,
  onEditRoom,
  onDeleteRoom,
}: {
  building: Building
  canEdit: boolean
  onEditBuilding: (b: Building) => void
  onDeleteBuilding: (b: Building) => void
  onAddRoom: (b: Building) => void
  onEditRoom: (b: Building, r: Room) => void
  onDeleteRoom: (b: Building, r: Room) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center gap-3">
          <button
            className="flex items-center gap-2 flex-1 text-left cursor-pointer"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded
              ? <ChevronDown size={16} className="text-muted-foreground shrink-0" />
              : <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
            <Building2 size={16} className="text-muted-foreground shrink-0" />
            <div>
              <p className="font-semibold text-foreground">{building.name}</p>
              {building.address && (
                <p className="text-xs text-muted-foreground">{building.address}</p>
              )}
            </div>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary">{building.rooms.length} sal</Badge>
            {building.faculty && (
              <Badge variant="outline">{building.faculty.shortName}</Badge>
            )}
            {!building.faculty && (
              <Badge variant="outline" className="text-muted-foreground">ogólnouczelniany</Badge>
            )}
            {canEdit && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditBuilding(building)}>
                  <Pencil size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => onDeleteBuilding(building)}
                >
                  <Trash2 size={13} />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-3">
          {building.rooms.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">Brak sal w tym budynku</p>
          )}
          {building.rooms.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-border mb-3">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Sala</th>
                    <th className="text-left px-3 py-2 font-medium">Typ</th>
                    <th className="text-center px-3 py-2 font-medium">Miejsca</th>
                    {canEdit && <th className="px-3 py-2 w-16" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {building.rooms
                    .slice()
                    .sort((a, b) => a.number.localeCompare(b.number))
                    .map((room) => (
                      <tr key={room.id} className="hover:bg-muted/50">
                        <td className="px-3 py-2 font-medium">{room.number}</td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${ROOM_TYPE_COLORS[room.type]}`}>
                            {ROOM_TYPE_LABELS[room.type]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{room.capacity}</td>
                        {canEdit && (
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onEditRoom(building, room)}
                              >
                                <Pencil size={11} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => onDeleteRoom(building, room)}
                              >
                                <Trash2 size={11} />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => onAddRoom(building)}>
              <Plus size={13} className="mr-1" />
              Dodaj salę
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ─── Strona ───────────────────────────────────────────────────

export function BuildingsPage() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const canEdit = user?.role === 'ADMIN'

  const [buildingDialog, setBuildingDialog] = useState<{ open: boolean; building: Building | null }>({
    open: false,
    building: null,
  })
  const [roomDialog, setRoomDialog] = useState<{ open: boolean; building: Building | null; room: Room | null }>({
    open: false,
    building: null,
    room: null,
  })

  const { data: facultiesData } = useQuery({
    queryKey: ['faculties'],
    queryFn: () => curriculumApi.getFaculties(),
  })

  const { data: buildingsData, isLoading } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => buildingsApi.getAll(),
  })

  const createBuilding = useMutation({
    mutationFn: (data: typeof EMPTY_BUILDING) =>
      buildingsApi.create({ name: data.name, address: data.address || undefined, facultyId: data.facultyId || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['buildings'] })
      setBuildingDialog({ open: false, building: null })
    },
  })

  const updateBuilding = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof EMPTY_BUILDING }) =>
      buildingsApi.update(id, { name: data.name, address: data.address || undefined, facultyId: data.facultyId || undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['buildings'] })
      setBuildingDialog({ open: false, building: null })
    },
  })

  const deleteBuilding = useMutation({
    mutationFn: (id: string) => buildingsApi.remove(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['buildings'] }),
  })

  const createRoom = useMutation({
    mutationFn: ({ buildingId, data }: { buildingId: string; data: typeof EMPTY_ROOM }) =>
      buildingsApi.createRoom(buildingId, { number: data.number, type: data.type, capacity: parseInt(data.capacity) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['buildings'] })
      setRoomDialog({ open: false, building: null, room: null })
    },
  })

  const updateRoom = useMutation({
    mutationFn: ({ buildingId, roomId, data }: { buildingId: string; roomId: string; data: typeof EMPTY_ROOM }) =>
      buildingsApi.updateRoom(buildingId, roomId, { number: data.number, type: data.type, capacity: parseInt(data.capacity) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['buildings'] })
      setRoomDialog({ open: false, building: null, room: null })
    },
  })

  const deleteRoom = useMutation({
    mutationFn: ({ buildingId, roomId }: { buildingId: string; roomId: string }) =>
      buildingsApi.removeRoom(buildingId, roomId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['buildings'] }),
  })

  const faculties = facultiesData?.data.data ?? []
  const buildings = buildingsData?.data.data ?? []

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Budynki i sale</h2>
          <p className="text-muted-foreground text-sm">Zarządzanie infrastrukturą dydaktyczną</p>
        </div>
        {canEdit && (
          <Button onClick={() => setBuildingDialog({ open: true, building: null })}>
            <Plus size={16} className="mr-2" />
            Dodaj budynek
          </Button>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground text-center py-16">Ładowanie…</p>}

      {!isLoading && buildings.length === 0 && (
        <p className="text-muted-foreground text-center py-16">Brak budynków</p>
      )}

      {!isLoading && buildings.length > 0 && (
        <div className="space-y-3">
          {buildings.map((b) => (
            <BuildingCard
              key={b.id}
              building={b}
              canEdit={canEdit}
              onEditBuilding={(b) => setBuildingDialog({ open: true, building: b })}
              onDeleteBuilding={(b) => {
                if (confirm(`Usunąć budynek „${b.name}"? Możliwe tylko jeśli nie ma sal.`))
                  deleteBuilding.mutate(b.id)
              }}
              onAddRoom={(b) => setRoomDialog({ open: true, building: b, room: null })}
              onEditRoom={(b, r) => setRoomDialog({ open: true, building: b, room: r })}
              onDeleteRoom={(b, r) => {
                if (confirm(`Usunąć salę ${r.number}?`))
                  deleteRoom.mutate({ buildingId: b.id, roomId: r.id })
              }}
            />
          ))}
        </div>
      )}

      <BuildingDialog
        open={buildingDialog.open}
        building={buildingDialog.building}
        faculties={faculties}
        onClose={() => setBuildingDialog({ open: false, building: null })}
        onSave={(data) => {
          if (buildingDialog.building) {
            updateBuilding.mutate({ id: buildingDialog.building.id, data })
          } else {
            createBuilding.mutate(data)
          }
        }}
      />

      <RoomDialog
        open={roomDialog.open}
        room={roomDialog.room}
        onClose={() => setRoomDialog({ open: false, building: null, room: null })}
        onSave={(data) => {
          const b = roomDialog.building!
          if (roomDialog.room) {
            updateRoom.mutate({ buildingId: b.id, roomId: roomDialog.room.id, data })
          } else {
            createRoom.mutate({ buildingId: b.id, data })
          }
        }}
      />
    </div>
  )
}
