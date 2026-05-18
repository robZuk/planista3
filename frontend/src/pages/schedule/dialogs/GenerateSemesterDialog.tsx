import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedule'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { ScheduleTemplate, StudyMode } from '@/types'

export function GenerateSemesterDialog({
  open,
  templates,
  academicYear,
  semesterType,
  onClose,
}: {
  open: boolean
  templates: Pick<ScheduleTemplate, 'id' | 'studyMode'>[]
  academicYear: string
  semesterType: string
  onClose: () => void
}) {
  type ConflictDetail = { date: string; type: string; subjectName: string; startTime: string; endTime: string; groupName: string | null; roomNumber: string }
  const [result, setResult] = useState<{ created: number; alreadyExists: number; conflicts: number; conflictDetails: ConflictDetail[] } | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const qc = useQueryClient()

  const groups = useMemo(() => {
    const map = new Map<StudyMode, string[]>()
    for (const t of templates) {
      if (!map.has(t.studyMode)) map.set(t.studyMode, [])
      map.get(t.studyMode)!.push(t.id)
    }
    return Array.from(map.entries()).map(([mode, ids]) => ({ mode, ids }))
  }, [templates])

  async function handleGenerate() {
    setPending(true)
    setError('')
    let created = 0, alreadyExists = 0, conflicts = 0
    const conflictDetails: ConflictDetail[] = []
    for (const { mode, ids } of groups) {
      try {
        const res = await scheduleApi.generateSemester({
          templateIds: ids,
          academicYear,
          semesterType,
          studyMode: mode,
        })
        created += res.data.data.created
        alreadyExists += (res.data.data as { alreadyExists?: number }).alreadyExists ?? 0
        conflicts += res.data.data.conflicts
        const resDetails = (res.data as { details?: { conflicts?: ConflictDetail[] } }).details
        conflictDetails.push(...(resDetails?.conflicts ?? []))
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd'
        setError(prev => prev ? `${prev}; ${msg}` : msg)
      }
    }
    qc.invalidateQueries({ queryKey: ['entries'] })
    setResult({ created, alreadyExists, conflicts, conflictDetails })
    setPending(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !pending) onClose() }}>
      <DialogContent className="max-w-sm" onInteractOutside={(e) => { if (pending) e.preventDefault() }} onEscapeKeyDown={(e) => { if (pending) e.preventDefault() }}>
        <DialogHeader>
          <DialogTitle>Generuj terminy semestru</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result ? (
            <div className="text-sm space-y-2">
              <p className="text-green-600 font-medium">Gotowe!</p>
              <p>Utworzono: <b>{result.created}</b> terminów</p>
              {result.alreadyExists > 0 && (
                <p className="text-muted-foreground">Już istniało: <b>{result.alreadyExists}</b> (pominięto)</p>
              )}
              <p className={result.conflicts > 0 ? 'text-destructive' : ''}>Konflikty: <b>{result.conflicts}</b></p>
              {result.conflictDetails.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto rounded border border-destructive/40 bg-destructive/5">
                  {result.conflictDetails.map((c, i) => (
                    <div key={i} className="px-2 py-1.5 border-b border-destructive/20 last:border-b-0">
                      <p className="font-medium truncate">{c.subjectName}</p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(c.date).toLocaleDateString('pl-PL')} · {c.startTime}–{c.endTime} · {c.roomNumber}
                        {c.groupName && ` · ${c.groupName}`}
                      </p>
                      <p className="text-destructive/80 text-xs">
                        {c.type === 'ROOM_CONFLICT' ? 'sala zajęta' : c.type === 'INSTRUCTOR_CONFLICT' ? 'prowadzący zajęty' : 'grupa zajęta'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Kontekst: <b>{academicYear} · {semesterType === 'WINTER' ? 'zimowy' : 'letni'}</b>
              </p>
              {groups.length === 0 ? (
                <p className="text-sm text-destructive">Brak wzorców pasujących do filtrów.</p>
              ) : (
                <div className="space-y-1">
                  {groups.map(({ mode, ids }) => (
                    <p key={mode} className="text-sm text-muted-foreground">
                      · {mode === 'FULL_TIME' ? 'Stacjonarne' : 'Niestacjonarne'} — {ids.length} wzorców
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {result ? 'Zamknij' : 'Anuluj'}
          </Button>
          {!result && (
            <Button
              onClick={() => void handleGenerate()}
              disabled={pending || groups.length === 0}
            >
              {pending ? 'Generowanie...' : 'Generuj'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
