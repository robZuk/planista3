import { SLOT_HEIGHT, SLOTS } from '../lib/constants'

export function TimeColumn() {
  return (
    <div className="w-14 flex-shrink-0 border-r border-border">
      <div className="min-h-[3.5rem] border-b border-border" />
      <div style={{ height: SLOTS.length * SLOT_HEIGHT }} className="relative">
        {SLOTS.map((slot, i) => {
          const isHour = slot.endsWith(':00')
          return (
            <div
              key={slot}
              style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
              className="absolute w-full flex items-start justify-end pr-1"
            >
              {isHour && (
                <span className="text-[10px] text-muted-foreground leading-none">{slot}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
