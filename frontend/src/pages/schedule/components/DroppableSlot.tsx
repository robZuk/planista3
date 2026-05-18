import { useDroppable } from '@dnd-kit/core'
import { SLOT_HEIGHT } from '../lib/constants'

export function DroppableSlot({
  id,
  children,
  onClick,
  top,
  disabled,
}: {
  id: string
  children?: React.ReactNode
  onClick?: () => void
  top: number
  disabled?: boolean
}) {
  const { setNodeRef } = useDroppable({ id, disabled })
  return (
    <div
      ref={setNodeRef}
      onClick={disabled ? undefined : onClick}
      className="absolute w-full"
      style={{ height: SLOT_HEIGHT, top }}
    >
      {children}
    </div>
  )
}
