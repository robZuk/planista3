import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedule'
import { useAcademicYearStore } from '@/store/academicYearStore'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { StudyMode } from '@/types'

export function CalendarDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { academicYear, semesterType } = useAcademicYearStore()
  const [form, setForm] = useState({
    academicYear,
    semesterType: semesterType as 'WINTER' | 'SUMMER',
    studyMode: 'FULL_TIME' as StudyMode,
    startDate: '',
    endDate: '',
    teachingWeeks: '15',
  })
  const [error, setError] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['calendars'],
    queryFn: () => scheduleApi.getCalendars(),
    enabled: open,
  })
  const calendars = existing?.data.data ?? []

  const mutation = useMutation({
    mutationFn: () => scheduleApi.createCalendar({
      academicYear: form.academicYear,
      semesterType: form.semesterType,
      studyMode: form.studyMode,
      startDate: form.startDate,
      endDate: form.endDate,
      teachingWeeks: Number(form.teachingWeeks),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendars'] }); setError('') },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scheduleApi.deleteCalendar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendars'] }),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Kalendarze semestrów</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {calendars.length > 0 && (
            <div className="space-y-2">
              {calendars.map(c => (
                <div key={c.id} className="flex items-center justify-between text-sm p-2 bg-muted/40 rounded">
                  <span>{c.academicYear} · {c.semesterType} · {c.studyMode === 'FULL_TIME' ? 'St.' : 'Nst.'} · {c.teachingWeeks} tyg.</span>
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(c.id)}>✕</Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm font-medium">Nowy kalendarz</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Rok akademicki</Label>
              <Input value={form.academicYear} onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))} placeholder="2024/2025" />
            </div>
            <div className="space-y-1">
              <Label>Semestr</Label>
              <Select value={form.semesterType} onValueChange={v => setForm(f => ({ ...f, semesterType: v as 'WINTER' | 'SUMMER' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WINTER">Zimowy</SelectItem>
                  <SelectItem value="SUMMER">Letni</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tryb</Label>
              <Select value={form.studyMode} onValueChange={v => setForm(f => ({ ...f, studyMode: v as StudyMode }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_TIME">Stacjonarne</SelectItem>
                  <SelectItem value="PART_TIME">Niestacjonarne</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tygodni</Label>
              <Input type="number" value={form.teachingWeeks} onChange={e => setForm(f => ({ ...f, teachingWeeks: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Data początku</Label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Data końca</Label>
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zamknij</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.startDate || !form.endDate}
          >
            {mutation.isPending ? 'Dodawanie...' : 'Dodaj'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
