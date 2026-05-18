import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedule'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ScheduleEntry } from '@/types'
import { CLASS_LABELS } from '../lib/constants'
import { EditEntryDialog } from '../dialogs/EditEntryDialog'

export function EntryDetailPanel({
  entry,
  onClose,
}: {
  entry: ScheduleEntry
  onClose: () => void
}) {
  const [showEdit, setShowEdit] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const qc = useQueryClient()
  const cancelMutation = useMutation({
    mutationFn: () => scheduleApi.deleteEntry(entry.id, true),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entries'] }); onClose() },
  })

  const deleteMutation = useMutation({
    mutationFn: (scope: 'ONE' | 'ALL') =>
      scope === 'ALL' && entry.templateId
        ? scheduleApi.deleteEntries({ templateId: entry.templateId })
        : scheduleApi.deleteEntry(entry.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['entries'] }); onClose() },
  })

  return (
    <>
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-xl p-6 w-80 space-y-3 border border-border"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{entry.curriculumEntry.subject.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p className="flex gap-2 items-center">
            <span className="font-medium text-foreground">Typ:</span>
            <Badge variant="secondary">{CLASS_LABELS[entry.classType]}</Badge>
          </p>
          <p><span className="font-medium text-foreground">Data:</span> {new Date(entry.date).toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' })}</p>
          <p><span className="font-medium text-foreground">Czas:</span> {entry.startTime} – {entry.endTime}</p>
          <p><span className="font-medium text-foreground">Sala:</span> {entry.room.number} ({entry.room.building.name})</p>
          <p><span className="font-medium text-foreground">Prowadzący:</span> {entry.instructor.firstName} {entry.instructor.lastName}</p>
          {entry.studentGroup && (
            <p><span className="font-medium text-foreground">Grupa:</span> {entry.studentGroup.name}</p>
          )}
          <p>
            <span className="font-medium text-foreground">Status:</span>{' '}
            <span className={entry.status === 'CANCELLED' ? 'text-destructive' : entry.status === 'MAKEUP' ? 'text-amber-600' : 'text-green-600'}>
              {entry.status === 'CANCELLED' ? 'Odwołane' : entry.status === 'MAKEUP' ? 'Odrobienie' : 'Zaplanowane'}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowEdit(true)}
          >
            Edytuj
          </Button>
          {entry.status === 'SCHEDULED' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => { if (confirm('Odwołać te zajęcia? (zmieni status na Odwołane)')) cancelMutation.mutate() }}
              disabled={cancelMutation.isPending || deleteMutation.isPending}
            >
              Odwołaj zajęcia
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteMutation.isPending || cancelMutation.isPending}
          >
            {deleteMutation.isPending ? 'Usuwanie...' : 'Usuń termin'}
          </Button>
        </div>
      </div>
    </div>

    {showDeleteConfirm && (
      <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center" onClick={() => setShowDeleteConfirm(false)}>
        <div
          className="bg-card rounded-xl shadow-xl p-6 w-80 space-y-4 border border-border"
          onClick={e => e.stopPropagation()}
        >
          <h3 className="font-semibold text-base">Usuń zajęcia</h3>
          <p className="text-sm text-muted-foreground">
            Czy usunąć tylko ten termin ({new Date(entry.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}), czy wszystkie terminy z tego wzorca w całym semestrze?
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => { setShowDeleteConfirm(false); deleteMutation.mutate('ONE') }}
            >
              Tylko ten termin
            </Button>
            {entry.templateId && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => { setShowDeleteConfirm(false); deleteMutation.mutate('ALL') }}
              >
                Wszystkie terminy (cały semestr)
              </Button>
            )}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowDeleteConfirm(false)}>
              Anuluj
            </Button>
          </div>
        </div>
      </div>
    )}

    {showEdit && (
      <EditEntryDialog
        entry={entry}
        onClose={() => setShowEdit(false)}
        onSuccess={onClose}
      />
    )}
    </>
  )
}
