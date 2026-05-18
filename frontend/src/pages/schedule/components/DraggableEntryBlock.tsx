import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Pencil } from 'lucide-react'
import type { ScheduleEntry } from '@/types'
import { CLASS_COLORS, CLASS_LABELS } from '../lib/constants'
import { blockStyle } from '../lib/time'

export function DraggableEntryBlock({
  entry,
  onClick,
}: {
  entry: ScheduleEntry
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    data: { type: 'entry', entry },
  })

  const isCancelled = entry.status === 'CANCELLED'
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 1,
    cursor: isCancelled ? 'default' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...blockStyle(entry.startTime, entry.endTime), ...{ transform: style.transform, opacity: style.opacity, zIndex: style.zIndex, cursor: style.cursor } }}
      {...(isCancelled ? {} : { ...listeners, ...attributes })}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`group rounded border-l-4 text-xs overflow-hidden transition-opacity ${CLASS_COLORS[entry.classType]} ${isCancelled ? 'opacity-50' : ''}`}
    >
      <div className="px-2 py-1 overflow-hidden h-full relative">
        <button
          className="absolute top-0.5 right-0.5 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-black/20 dark:hover:bg-white/20 transition-opacity z-10"
          onPointerDown={e => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onClick() }}
          title="Szczegóły / edycja"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <p className={`font-semibold truncate leading-tight pr-4 ${isCancelled ? 'line-through' : ''}`}>{entry.curriculumEntry.subject.name}</p>
        <p className="truncate opacity-70">
          {CLASS_LABELS[entry.classType]} · {entry.room.number}
          {entry.status === 'CANCELLED' && ' · Odwołane'}
          {entry.status === 'MAKEUP' && ' · Odrobienie'}
        </p>
        <p className="truncate opacity-60">{entry.startTime}–{entry.endTime}</p>
        <p className="truncate opacity-60">
          {entry.instructor.title ? `${entry.instructor.title} ` : ''}{entry.instructor.firstName[0]}. {entry.instructor.lastName}
        </p>
        {entry.studentGroup && (
          <p className="truncate opacity-60">{entry.studentGroup.name}</p>
        )}
      </div>
    </div>
  )
}
