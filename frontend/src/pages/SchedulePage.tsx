import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedule'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { ScheduleEntry, DayOfWeek, ClassType } from '@/types'

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'MONDAY', label: 'Pon' },
  { key: 'TUESDAY', label: 'Wt' },
  { key: 'WEDNESDAY', label: 'Śr' },
  { key: 'THURSDAY', label: 'Czw' },
  { key: 'FRIDAY', label: 'Pt' },
]

const CLASS_COLORS: Record<ClassType, string> = {
  LECTURE:  'bg-blue-500/15   border-blue-400   text-blue-800   dark:bg-blue-500/20   dark:text-blue-300',
  EXERCISE: 'bg-green-500/15  border-green-400  text-green-800  dark:bg-green-500/20  dark:text-green-300',
  LAB:      'bg-orange-500/15 border-orange-400 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',
  PROJECT:  'bg-purple-500/15 border-purple-400 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300',
  SEMINAR:  'bg-pink-500/15   border-pink-400   text-pink-800   dark:bg-pink-500/20   dark:text-pink-300',
}

const CLASS_LABELS: Record<ClassType, string> = {
  LECTURE: 'W',
  EXERCISE: 'C',
  LAB: 'L',
  PROJECT: 'P',
  SEMINAR: 'S',
}

function generateSlots(): string[] {
  const slots: string[] = []
  for (let h = 7; h < 20; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

const SLOTS = generateSlots()
const SLOT_HEIGHT = 32
const START_MINUTES = 7 * 60

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function entryStyle(entry: ScheduleEntry): React.CSSProperties {
  const start = timeToMinutes(entry.startTime) - START_MINUTES
  const duration = timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime)
  return {
    position: 'absolute',
    top: (start / 30) * SLOT_HEIGHT,
    height: Math.max((duration / 30) * SLOT_HEIGHT - 2, 20),
    left: 4,
    right: 4,
  }
}

function ScheduleBlock({ entry, onClick }: { entry: ScheduleEntry; onClick: () => void }) {
  return (
    <div
      style={entryStyle(entry)}
      className={`rounded border-l-4 px-2 py-1 text-xs cursor-pointer hover:opacity-80 transition-opacity overflow-hidden ${CLASS_COLORS[entry.classType]}`}
      onClick={onClick}
    >
      <p className="font-semibold truncate leading-tight">{entry.curriculumEntry.subject.name}</p>
      <p className="truncate opacity-75">
        {CLASS_LABELS[entry.classType]} · {entry.room.number}
      </p>
    </div>
  )
}

function DetailPanel({ entry, onClose }: { entry: ScheduleEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-xl p-6 w-80 space-y-3 border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{entry.curriculumEntry.subject.name}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">
            ×
          </button>
        </div>
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p className="flex gap-2 items-center">
            <span className="font-medium text-foreground">Typ:</span>
            <Badge variant="secondary">{CLASS_LABELS[entry.classType]}</Badge>
          </p>
          <p><span className="font-medium text-foreground">Czas:</span> {entry.startTime} – {entry.endTime}</p>
          <p><span className="font-medium text-foreground">Sala:</span> {entry.room.number} ({entry.room.building.name})</p>
          <p><span className="font-medium text-foreground">Prowadzący:</span> {entry.instructor.firstName} {entry.instructor.lastName}</p>
          {entry.studentGroup && (
            <p><span className="font-medium text-foreground">Grupa:</span> {entry.studentGroup.name}</p>
          )}
          <p><span className="font-medium text-foreground">Semestr:</span> {entry.semester} · {entry.academicYear}</p>
        </div>
      </div>
    </div>
  )
}

export function SchedulePage() {
  const [semester, setSemester] = useState<string>('')
  const [academicYear, setAcademicYear] = useState('2024/2025')
  const [selectedEntry, setSelectedEntry] = useState<ScheduleEntry | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['schedule', semester, academicYear],
    queryFn: () =>
      scheduleApi.getAll({
        semester: semester ? parseInt(semester) : undefined,
        academicYear,
      }),
  })

  const entries = data?.data.data ?? []
  const byDay = Object.fromEntries(
    DAYS.map((d) => [d.key, entries.filter((e) => e.dayOfWeek === d.key)])
  ) as Record<DayOfWeek, ScheduleEntry[]>

  const totalSlotsHeight = SLOTS.length * SLOT_HEIGHT

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Plan zajęć</h2>
        <p className="text-muted-foreground text-sm">Widok tygodniowy</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-card rounded-lg border border-border">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Rok akademicki</label>
          <Select value={academicYear} onValueChange={setAcademicYear}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024/2025">2024/2025</SelectItem>
              <SelectItem value="2023/2024">2023/2024</SelectItem>
              <SelectItem value="2022/2023">2022/2023</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Semestr</label>
          <Select value={semester || undefined} onValueChange={setSemester}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Wszystkie" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 7 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  Semestr {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <div className="text-center py-16 text-muted-foreground">Ładowanie...</div>}

      {!isLoading && entries.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">Brak zajęć dla wybranych filtrów</div>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-auto">
          <div className="flex min-w-[640px]">
            {/* Kolumna czasu */}
            <div className="w-12 flex-shrink-0 border-r border-border">
              <div className="h-10 border-b border-border" />
              <div style={{ height: totalSlotsHeight }} className="relative">
                {SLOTS.map((slot, i) => (
                  <div
                    key={slot}
                    style={{ top: i * SLOT_HEIGHT }}
                    className="absolute w-full flex items-start justify-end pr-1 text-[10px] text-muted-foreground"
                  >
                    {slot.endsWith(':00') ? slot : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Kolumny dni */}
            {DAYS.map((day) => (
              <div key={day.key} className="flex-1 border-r border-border last:border-r-0">
                <div className="h-10 border-b border-border flex items-center justify-center text-sm font-medium text-foreground">
                  {day.label}
                </div>
                <div style={{ height: totalSlotsHeight }} className="relative">
                  {SLOTS.map((slot, i) => (
                    <div
                      key={slot}
                      style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                      className={`absolute w-full border-b ${slot.endsWith(':00') ? 'border-border' : 'border-border/40'}`}
                    />
                  ))}
                  {byDay[day.key]?.map((entry) => (
                    <ScheduleBlock key={entry.id} entry={entry} onClick={() => setSelectedEntry(entry)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedEntry && <DetailPanel entry={selectedEntry} onClose={() => setSelectedEntry(null)} />}
    </div>
  )
}
