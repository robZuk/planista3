import { useState } from 'react'
import { useAcademicYearStore } from '@/store/academicYearStore'
import { TemplateTab } from './schedule/TemplateTab'
import { CalendarTab } from './schedule/CalendarTab'

export function SchedulePage() {
  const { academicYear, semesterType } = useAcademicYearStore()
  const [tab, setTab] = useState<'template' | 'calendar'>('template')

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Plan zajęć</h2>
        <p className="text-muted-foreground text-sm">Wzorzec tygodniowy i konkretne terminy</p>
      </div>

      <div className="flex gap-1 mb-4 border-b border-border">
        <button
          onClick={() => setTab('template')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'template'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Wzorzec tygodnia
        </button>
        <button
          onClick={() => setTab('calendar')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'calendar'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Kalendarz semestru
        </button>
      </div>

      {tab === 'template' && <TemplateTab key={`${academicYear}-${semesterType}`} academicYear={academicYear} />}
      {tab === 'calendar' && <CalendarTab key={`${academicYear}-${semesterType}`} academicYear={academicYear} />}
    </div>
  )
}
