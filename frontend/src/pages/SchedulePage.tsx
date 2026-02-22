import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { scheduleApi } from '@/api/schedule'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { ScheduleEntry, DayOfWeek, ClassType } from '@/types'

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'MONDAY', label: 'Poniedziałek' },
  { key: 'TUESDAY', label: 'Wtorek' },
  { key: 'WEDNESDAY', label: 'Środa' },
  { key: 'THURSDAY', label: 'Czwartek' },
  { key: 'FRIDAY', label: 'Piątek' },
]

const CLASS_COLORS: Record<ClassType, string> = {
  LECTURE: 'bg-blue-100 border-blue-400 text-blue-800',
  EXERCISE: 'bg-green-100 border-green-400 text-green-800',
  LAB: 'bg-orange-100 border-orange-400 text-orange-800',
  PROJECT: 'bg-purple-100 border-purple-400 text-purple-800',
  SEMINAR: 'bg-pink-100 border-pink-400 text-pink-800',
}

const CLASS_LABELS: Record<ClassType, string> = {
  LECTURE: 'W',
  EXERCISE: 'C',
  LAB: 'L',
  PROJECT: 'P',
  SEMINAR: 'S',
}

// Generuje sloty od 7:00 do 20:00 co 30 min
function generateSlots(): string[] {
  const slots: string[] = []
  for (let h = 7; h < 20; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

const SLOTS = generateSlots()

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

const SLOT_HEIGHT = 32 // px per 30-min slot
const START_MINUTES = 7 * 60 // 7:00

function entryStyle(entry: ScheduleEntry): React.CSSProperties {
  const start = timeToMinutes(entry.startTime) - START_MINUTES
  const duration = timeToMinutes(entry.endTime) - timeToMinutes(entry.startTime)
  const top = (start / 30) * SLOT_HEIGHT
  const height = (duration / 30) * SLOT_HEIGHT
  return { position: 'absolute', top, height, left: 4, right: 4 }
}

function ScheduleBlock({
  entry,
  onClick,
}: {
  entry: ScheduleEntry
  onClick: () => void
}) {
  const color = CLASS_COLORS[entry.classType]
  return (
    <div
      style={entryStyle(entry)}
      className={`rounded border-l-4 px-2 py-1 text-xs cursor-pointer hover:opacity-80 transition-opacity overflow-hidden ${color}`}
      onClick={onClick}
    >
      <p className="font-semibold truncate">{entry.curriculumEntry.subject.name}</p>
      <p className="truncate text-gray-600">
        {CLASS_LABELS[entry.classType]} · {entry.room.number} ({entry.room.building.name})
      </p>
      <p className="truncate text-gray-600">{entry.instructor.lastName}</p>
    </div>
  )
}

function DetailPanel({ entry, onClose }: { entry: ScheduleEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-80 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-gray-900">{entry.curriculumEntry.subject.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">
            ×
          </button>
        </div>
        <div className="space-y-1 text-sm text-gray-600">
          <p>
            <span className="font-medium">Typ:</span>{' '}
            <Badge variant="secondary">{CLASS_LABELS[entry.classType]}</Badge>
          </p>
          <p>
            <span className="font-medium">Czas:</span> {entry.startTime} – {entry.endTime}
          </p>
          <p>
            <span className="font-medium">Sala:</span> {entry.room.number} ({entry.room.building.name})
          </p>
          <p>
            <span className="font-medium">Prowadzący:</span> {entry.instructor.firstName}{' '}
            {entry.instructor.lastName}
          </p>
          {entry.studentGroup && (
            <p>
              <span className="font-medium">Grupa:</span> {entry.studentGroup.name}
            </p>
          )}
          <p>
            <span className="font-medium">Semestr:</span> {entry.semester}
          </p>
          <p>
            <span className="font-medium">Rok akad.:</span> {entry.academicYear}
          </p>
        </div>
      </div>
    </div>
  )
}

export function SchedulePage() {
  const [semester, setSemester] = useState('')
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

  // Grupuj po dniu tygodnia
  const byDay = Object.fromEntries(
    DAYS.map((d) => [d.key, entries.filter((e) => e.dayOfWeek === d.key)])
  ) as Record<DayOfWeek, ScheduleEntry[]>

  const totalSlotsHeight = SLOTS.length * SLOT_HEIGHT

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Plan zajęć</h2>
        <p className="text-gray-500 text-sm">Widok tygodniowy</p>
      </div>

      {/* Filtry */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Rok akademicki</label>
          <Select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="w-36">
            <option value="2024/2025">2024/2025</option>
            <option value="2023/2024">2023/2024</option>
            <option value="2022/2023">2022/2023</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Semestr</label>
          <Select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-36">
            <option value="">Wszystkie</option>
            {Array.from({ length: 7 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>
                Semestr {i + 1}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading && <div className="text-center py-16 text-gray-400">Ładowanie...</div>}

      {!isLoading && entries.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p>Brak zajęć dla wybranych filtrów</p>
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-auto">
          <div className="flex">
            {/* Kolumna czasu */}
            <div className="w-14 flex-shrink-0 border-r border-gray-200">
              <div className="h-10 border-b border-gray-200" />
              <div style={{ height: totalSlotsHeight }} className="relative">
                {SLOTS.map((slot, i) => (
                  <div
                    key={slot}
                    style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                    className="absolute w-full flex items-start justify-end pr-2 text-xs text-gray-400"
                  >
                    {slot.endsWith(':00') ? slot : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Kolumny dni */}
            {DAYS.map((day) => (
              <div key={day.key} className="flex-1 min-w-28 border-r border-gray-200 last:border-r-0">
                <div className="h-10 border-b border-gray-200 flex items-center justify-center text-sm font-medium text-gray-700">
                  {day.label}
                </div>
                <div style={{ height: totalSlotsHeight }} className="relative">
                  {/* Linie siatki */}
                  {SLOTS.map((slot, i) => (
                    <div
                      key={slot}
                      style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                      className={`absolute w-full border-b ${slot.endsWith(':00') ? 'border-gray-200' : 'border-gray-100'}`}
                    />
                  ))}
                  {/* Bloki zajęć */}
                  {byDay[day.key]?.map((entry) => (
                    <ScheduleBlock key={entry.id} entry={entry} onClick={() => setSelectedEntry(entry)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedEntry && (
        <DetailPanel entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </div>
  )
}
