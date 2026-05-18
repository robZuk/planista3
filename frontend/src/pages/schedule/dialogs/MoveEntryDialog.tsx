import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedule'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { ScheduleEntry } from '@/types'
import { formatApiError } from '../lib/errors'

export function MoveEntryDialog({
  entry,
  targetDate,
  targetStartTime,
  targetEndTime,
  onClose,
  onSuccess,
}: {
  entry: ScheduleEntry
  targetDate: string
  targetStartTime: string
  targetEndTime: string
  onClose: () => void
  onSuccess: () => void
}) {
  const qc = useQueryClient()
  const [scope, setScope] = useState<'ONE' | 'ALL'>('ONE')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => scheduleApi.moveEntry(entry.id, {
      newDate: targetDate,
      newStartTime: targetStartTime,
      newEndTime: targetEndTime,
      scope,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] })
      qc.invalidateQueries({ queryKey: ['templates'] })
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
        <DialogHeader><DialogTitle>Przenieś zajęcia</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          {error && <p className="text-destructive">{error}</p>}
          <p><span className="font-medium">Przedmiot:</span> {entry.curriculumEntry.subject.name}</p>
          <p><span className="font-medium">Nowy termin:</span> {new Date(targetDate).toLocaleDateString('pl-PL')} {targetStartTime}–{targetEndTime}</p>
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={scope === 'ONE'} onChange={() => setScope('ONE')} />
              <span>Tylko ten termin ({new Date(entry.date).toLocaleDateString('pl-PL')})</span>
            </label>
            {entry.templateId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={scope === 'ALL'} onChange={() => setScope('ALL')} />
                <span>Wszystkie przyszłe terminy z tego wzorca</span>
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Przenoszenie...' : 'Przenieś'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
