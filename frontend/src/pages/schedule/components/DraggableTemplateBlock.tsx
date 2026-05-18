import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Pencil } from 'lucide-react'
import type { ScheduleTemplate } from '@/types'
import { CLASS_COLORS, CLASS_LABELS, WEEK_TYPE_LABELS } from '../lib/constants'
import { blockStyle } from '../lib/time'

export function DraggableTemplateBlock({
  template,
  onClick,
}: {
  template: ScheduleTemplate
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: template.id,
    data: { type: 'template', template },
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 1,
    cursor: 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...blockStyle(template.startTime, template.endTime), ...{ transform: style.transform, opacity: style.opacity, zIndex: style.zIndex, cursor: style.cursor } }}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`group rounded border-l-4 text-xs overflow-hidden transition-opacity ${CLASS_COLORS[template.classType]}`}
    >
      <div className="px-2 py-1 overflow-hidden h-full relative">
        <button
          className="absolute top-0.5 right-0.5 p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-black/20 dark:hover:bg-white/20 transition-opacity z-10"
          onPointerDown={e => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onClick() }}
          title="Edytuj wzorzec"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <p className="font-semibold truncate leading-tight pr-4">{template.curriculumEntry.subject.name}</p>
        <p className="truncate opacity-70">
          {CLASS_LABELS[template.classType]} · {template.room.number} · {WEEK_TYPE_LABELS[template.weekType]}
        </p>
        <p className="truncate opacity-60">{template.startTime}–{template.endTime}</p>
        <p className="truncate opacity-60">
          {template.instructor.title ? `${template.instructor.title} ` : ''}{template.instructor.firstName[0]}. {template.instructor.lastName}
        </p>
        {template.studentGroup && (
          <p className="truncate opacity-60">{template.studentGroup.name}</p>
        )}
      </div>
    </div>
  )
}
