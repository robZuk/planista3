import { ChevronDown } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function GroupCheckboxPicker({
  groups,
  selected,
  onChange,
  disabled,
  triggerClassName,
}: {
  groups: { id: string; name: string }[]
  selected: Set<string> | null
  onChange: (next: Set<string> | null) => void
  disabled?: boolean
  triggerClassName?: string
}) {
  // null = brak filtra (wszystkie), Set = jawny wybór (pusty = żadna)
  const allSelected = selected === null

  const toggle = (id: string) => {
    if (allSelected) {
      onChange(new Set(groups.map(g => g.id).filter(gid => gid !== id)))
    } else {
      const next = new Set(selected)
      if (next.has(id)) {
        next.delete(id)
        onChange(next)
      } else {
        next.add(id)
        onChange(next)
      }
    }
  }

  const label = allSelected
    ? 'Wszystkie grupy'
    : selected.size === 0
      ? 'Brak grup'
      : selected.size === 1
        ? (groups.find(g => g.id === [...selected][0])?.name ?? '1 grupa')
        : `${selected.size} grup`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`border-input flex items-center justify-between gap-2 rounded-md border bg-transparent px-3 shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50 h-8 text-xs text-left whitespace-nowrap ${triggerClassName ?? 'w-full'}`}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        {groups.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1">Brak grup</p>
        ) : (
          <>
            <button
              type="button"
              className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent transition-colors mb-1"
              onClick={() => onChange(allSelected ? new Set() : null)}
            >
              {allSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
            </button>
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {groups.map(g => (
                <label
                  key={g.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                >
                  <Checkbox
                    checked={allSelected || (selected !== null && selected.has(g.id))}
                    onCheckedChange={() => toggle(g.id)}
                  />
                  <span className="text-xs">{g.name}</span>
                </label>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
