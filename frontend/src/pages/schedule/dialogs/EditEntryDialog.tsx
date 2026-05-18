import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedule'
import { buildingsApi } from '@/api/buildings'
import { instructorsApi } from '@/api/instructors'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ScheduleEntry } from '@/types'
import { CLASS_LABELS } from '../lib/constants'
import { formatApiError } from '../lib/errors'

export function EditEntryDialog({
  entry,
  onClose,
  onSuccess,
}: {
  entry: ScheduleEntry
  onClose: () => void
  onSuccess: () => void
}) {
  const qc = useQueryClient()
  const [scope, setScope] = useState<'ONE' | 'ALL'>('ONE')
  const [date, setDate] = useState(entry.date.slice(0, 10))
  const [startTime, setStartTime] = useState(entry.startTime)
  const [endTime, setEndTime] = useState(entry.endTime)
  const [roomId, setRoomId] = useState(entry.room.id)
  const [instructorId, setInstructorId] = useState(entry.instructor.id)
  const [error, setError] = useState('')

  const { data: buildingsData } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => buildingsApi.getAll(),
  })
  const { data: instructorsData } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.getAll(),
  })

  const allRooms = buildingsData?.data.data.flatMap(b => b.rooms.map(r => ({ ...r, buildingName: b.name }))) ?? []
  const instructors = instructorsData?.data.data ?? []

  const mutation = useMutation({
    mutationFn: () => scheduleApi.updateEntry(entry.id, {
      ...(scope === 'ONE' ? { date } : {}),
      startTime, endTime, roomId, instructorId, scope,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] })
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edytuj termin zajęć</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          {error && <p className="text-destructive text-sm">{error}</p>}
          <p className="font-medium">{entry.curriculumEntry.subject.name} · {CLASS_LABELS[entry.classType]}</p>

          {entry.templateId && (
            <div className="space-y-1.5 rounded-md border border-border p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={scope === 'ONE'} onChange={() => setScope('ONE')} />
                <span>Tylko ten termin ({new Date(entry.date).toLocaleDateString('pl-PL')})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={scope === 'ALL'} onChange={() => setScope('ALL')} />
                <span>Wszystkie przyszłe terminy z tego wzorca</span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {scope === 'ONE' && (
              <div className="col-span-2 space-y-1">
                <Label>Data</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <Label>Od</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Do</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Sala</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allRooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.number} ({r.type}, poj. {r.capacity}) – {r.buildingName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Prowadzący</Label>
              <Select value={instructorId} onValueChange={setInstructorId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Zapisywanie...' : 'Zapisz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
