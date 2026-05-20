import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedule'
import { useAcademicYearStore } from '@/store/academicYearStore'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SemesterCalendar } from '@/types'

const STUDY_MODES = ['FULL_TIME', 'PART_TIME'] as const

export function CalendarDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { academicYear, semesterType } = useAcademicYearStore()

  const { data: existing } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => scheduleApi.getCalendars(),
    enabled: open,
  })
  const allCalendars: SemesterCalendar[] = existing?.data.data ?? []
  const contextCalendars = allCalendars.filter(
    c => c.academicYear === academicYear && c.semesterType === semesterType
  )
  const reference = contextCalendars[0]

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (reference) {
      setStartDate(reference.startDate.slice(0, 10))
      setEndDate(reference.endDate.slice(0, 10))
    }
  }, [reference?.id])
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const semesterLabel = semesterType === 'WINTER' ? 'zimowy' : 'letni'

  async function handleSave() {
    setError('')
    setPending(true)
    try {
      await Promise.all(STUDY_MODES.map(mode => {
        const cal = contextCalendars.find(c => c.studyMode === mode)
        return cal
          ? scheduleApi.updateCalendar(cal.id, { startDate, endDate })
          : scheduleApi.createCalendar({ academicYear, semesterType, studyMode: mode, startDate, endDate })
      }))
      qc.invalidateQueries({ queryKey: ['calendars'] })
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd')
    }
    setPending(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Kalendarz semestru — {academicYear} {semesterLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data początku</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data końca</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zamknij</Button>
          <Button onClick={() => void handleSave()} disabled={pending || !startDate || !endDate}>
            {pending ? 'Zapisywanie...' : reference ? 'Zapisz' : 'Utwórz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
