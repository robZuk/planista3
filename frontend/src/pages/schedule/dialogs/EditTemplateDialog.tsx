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
import type { ScheduleTemplate } from '@/types'
import { CLASS_LABELS, DAY_SHORT, ROOM_TYPES_FOR_CLASS } from '../lib/constants'
import { formatApiError } from '../lib/errors'

export function EditTemplateDialog({
  template,
  onClose,
  onSuccess,
}: {
  template: ScheduleTemplate
  onClose: () => void
  onSuccess: () => void
}) {
  const qc = useQueryClient()
  const [weekType, setWeekType]       = useState(template.weekType)
  const [startTime, setStartTime]     = useState(template.startTime)
  const [endTime, setEndTime]         = useState(template.endTime)
  const [instructorId, setInstructorId] = useState(template.instructor.id)
  const [roomId, setRoomId]           = useState(template.room.id)
  const [error, setError]             = useState('')

  const { data: instructorsData } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => instructorsApi.getAll(),
  })
  const { data: buildingsData } = useQuery({
    queryKey: ['buildings'],
    queryFn: () => buildingsApi.getAll(),
  })

  const instructors = instructorsData?.data.data ?? []
  const allRooms = buildingsData?.data.data.flatMap(b =>
    b.rooms.map(r => ({ ...r, buildingName: b.name }))
  ) ?? []
  const allowedRoomTypes = ROOM_TYPES_FOR_CLASS[template.classType] ?? []
  const filteredRooms = allRooms.filter(r => allowedRoomTypes.includes(r.type))

  const updateMutation = useMutation({
    mutationFn: () => scheduleApi.updateTemplate(template.id, { weekType, startTime, endTime, instructorId, roomId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); qc.invalidateQueries({ queryKey: ['templates-all'] }); onSuccess(); onClose() },
    onError: (e: unknown) => {
      const data = (e as { response?: { data?: { error?: string; details?: Record<string, unknown> } } })?.response?.data
      setError(data?.error ? formatApiError(data.error, data.details) : 'Błąd zapisu — spróbuj ponownie')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => scheduleApi.deleteTemplate(template.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); qc.invalidateQueries({ queryKey: ['templates-all'] }); onClose() },
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edytuj wzorzec zajęć</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="rounded-md bg-muted/50 px-3 py-2 space-y-0.5 text-xs text-muted-foreground">
            <p><span className="font-medium text-foreground">{template.curriculumEntry.subject.name}</span></p>
            <p>{CLASS_LABELS[template.classType]} · {DAY_SHORT[template.dayOfWeek] ?? template.dayOfWeek}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Od</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Do</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Cykl</Label>
              <Select value={weekType} onValueChange={v => setWeekType(v as typeof weekType)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EVERY">Co tydzień</SelectItem>
                  <SelectItem value="EVEN">Tygodnie parzyste</SelectItem>
                  <SelectItem value="ODD">Tygodnie nieparzyste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Prowadzący</Label>
              <Select value={instructorId} onValueChange={setInstructorId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {instructors.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.title ? `${i.title} ` : ''}{i.firstName} {i.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Sala</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {filteredRooms.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.number} ({r.buildingName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => { if (confirm('Usunąć ten wzorzec?')) deleteMutation.mutate() }}
            disabled={deleteMutation.isPending}
          >
            Usuń
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Anuluj</Button>
            <Button onClick={() => { setError(''); updateMutation.mutate() }} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
