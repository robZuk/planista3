import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedule'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { StudyMode } from '@/types'

type ConflictDetail = { date: string; type: string; subjectName: string; startTime: string; endTime: string; groupName: string | null; roomNumber: string }
type GenerateResult = { created: number; alreadyExists: number; conflicts: number; conflictDetails: ConflictDetail[] }

const ALL_MODES: StudyMode[] = ['FULL_TIME', 'PART_TIME']
const MODE_LABEL: Record<StudyMode, string> = { FULL_TIME: 'Stacjonarne', PART_TIME: 'Niestacjonarne' }

export function GenerateSemesterDialog({
  open,
  academicYear,
  semesterType,
  studyMode,
  specializationId,
  fieldOfStudyId,
  semester,
  facultyName,
  specializationName,
  fieldOfStudyName,
  onClose,
}: {
  open: boolean
  academicYear: string
  semesterType: string
  studyMode: StudyMode | ''
  specializationId?: string
  fieldOfStudyId?: string
  semester?: number
  facultyName?: string
  specializationName?: string
  fieldOfStudyName?: string
  onClose: () => void
}) {
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const qc = useQueryClient()

  const { data: calendarsData } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => scheduleApi.getCalendars(),
    enabled: open,
  })
  const allCalendars = calendarsData?.data.data ?? []

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })

  function getEffectiveDates(mode: StudyMode) {
    const cal = allCalendars.find(c => c.academicYear === academicYear && c.semesterType === semesterType && c.studyMode === mode)
    if (cal) return { start: cal.startDate.slice(0, 10), end: cal.endDate.slice(0, 10), isDefault: false }
    const y1 = parseInt(academicYear.split('/')[0] ?? '2024')
    const y2 = y1 + 1
    const dates = semesterType === 'WINTER'
      ? { start: `${y1}-10-01`, end: `${y2}-02-02` }
      : { start: `${y2}-02-17`, end: `${y2}-06-22` }
    return { ...dates, isDefault: true }
  }

  const { data: templatesData } = useQuery({
    queryKey: ['templates-gen', academicYear, semesterType, studyMode, specializationId, fieldOfStudyId, semester],
    queryFn: () => scheduleApi.getTemplates({
      academicYear,
      semesterType: semester ? undefined : semesterType as 'WINTER' | 'SUMMER',
      studyMode: studyMode || undefined,
      semester,
      ...(specializationId ? { specializationId } : fieldOfStudyId ? { fieldOfStudyId } : {}),
    }),
    enabled: open,
  })
  const templates = templatesData?.data.data ?? []

  const modesToRun: StudyMode[] = studyMode ? [studyMode] : ALL_MODES

  function templateIdsForMode(mode: StudyMode) {
    return studyMode
      ? templates.map(t => t.id)
      : templates.filter(t => t.studyMode === mode).map(t => t.id)
  }

  const modeInfos = modesToRun.map(mode => ({
    mode,
    label: MODE_LABEL[mode],
    dates: getEffectiveDates(mode),
    ids: templateIdsForMode(mode),
  }))

  const runnableModes = modeInfos.filter(m => !m.dates.isDefault && m.ids.length > 0)
  const missingCalendarModes = modeInfos.filter(m => m.dates.isDefault && m.ids.length > 0)
  const emptyModes = modeInfos.filter(m => m.ids.length === 0)
  const totalTemplates = templates.length

  async function handleGenerate() {
    setPending(true)
    setError('')
    try {
      let totalCreated = 0
      let totalAlreadyExists = 0
      let totalConflicts = 0
      const allConflictDetails: ConflictDetail[] = []

      for (const { mode, ids } of runnableModes) {
        if (ids.length === 0) continue
        const res = await scheduleApi.generateSemester({ templateIds: ids, academicYear, semesterType, studyMode: mode })
        totalCreated += res.data.data.created
        totalAlreadyExists += (res.data.data as { alreadyExists?: number }).alreadyExists ?? 0
        totalConflicts += res.data.data.conflicts
        const details = (res.data as { details?: { conflicts?: ConflictDetail[] } }).details
        if (details?.conflicts) allConflictDetails.push(...details.conflicts)
      }

      qc.invalidateQueries({ queryKey: ['entries'] })
      setResult({ created: totalCreated, alreadyExists: totalAlreadyExists, conflicts: totalConflicts, conflictDetails: allConflictDetails })
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd')
    }
    setPending(false)
  }

  const studyModeLabel = studyMode === 'FULL_TIME' ? 'Stacjonarne' : studyMode === 'PART_TIME' ? 'Niestacjonarne' : 'Wszystkie tryby'
  const isLoading = templatesData === undefined
  const canGenerate = !isLoading && runnableModes.length > 0

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
              <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
                <div><span className="text-muted-foreground">Rok akademicki:</span> <strong>{academicYear}</strong></div>
                {facultyName && (
                  <div><span className="text-muted-foreground">Wydział:</span> <strong>{facultyName}</strong></div>
                )}
                <div><span className="text-muted-foreground">Semestr:</span> <strong>{semester ? `sem. ${semester}` : semesterType === 'WINTER' ? 'zimowy' : 'letni'}</strong></div>
                <div><span className="text-muted-foreground">Tryb:</span> <strong>{studyModeLabel}</strong></div>
                {fieldOfStudyName && !specializationName && (
                  <div><span className="text-muted-foreground">Kierunek:</span> <strong>{fieldOfStudyName}</strong></div>
                )}
                {specializationName && (
                  <div><span className="text-muted-foreground">Specjalność:</span> <strong>{specializationName}</strong></div>
                )}
                {!fieldOfStudyId && !specializationId && (
                  <div><span className="text-muted-foreground">Zakres:</span> <strong>cały semestr</strong></div>
                )}
                {(() => {
                  const nonDefault = modeInfos.filter(m => !m.dates.isDefault)
                  const anyMissing = modeInfos.some(m => m.dates.isDefault)
                  const start = nonDefault.length ? nonDefault.reduce((a, b) => a.dates.start < b.dates.start ? a : b).dates.start : modeInfos[0]!.dates.start
                  const end = nonDefault.length ? nonDefault.reduce((a, b) => a.dates.end > b.dates.end ? a : b).dates.end : modeInfos[0]!.dates.end
                  const isDefault = modeInfos.every(m => m.dates.isDefault)
                  return (
                    <div>
                      <span className="text-muted-foreground">Daty:</span>{' '}
                      <strong>{fmtDate(start)} – {fmtDate(end)}</strong>
                      {isDefault && (
                        <span className="ml-2 text-yellow-600 dark:text-yellow-400 text-xs">(domyślne — brak kalendarza semestru)</span>
                      )}
                      {!isDefault && anyMissing && (
                        <span className="ml-2 text-yellow-600 dark:text-yellow-400 text-xs">(brak kalendarza dla jednego trybu)</span>
                      )}
                    </div>
                  )
                })()}
              </div>

              {isLoading ? (
                <p className="text-sm text-muted-foreground">Ładowanie wzorców...</p>
              ) : totalTemplates === 0 ? (
                <p className="text-sm text-destructive">Brak wzorców dla wybranego zakresu.</p>
              ) : (
                <div className="text-sm space-y-1">
                  {runnableModes.length > 0 && (
                    <p className="text-muted-foreground">
                      {runnableModes.reduce((s, m) => s + m.ids.length, 0)} wzorców do przetworzenia
                    </p>
                  )}
                  {missingCalendarModes.map(m => (
                    <p key={m.mode} className="text-destructive">
                      {m.label}: brak kalendarza semestru — ustaw daty przed generowaniem.
                    </p>
                  ))}
                  {emptyModes.map(m => (
                    <p key={m.mode} className="text-muted-foreground text-xs">
                      {m.label}: brak wzorców.
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
              disabled={pending || !canGenerate}
            >
              {pending ? 'Generowanie...' : 'Generuj'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
