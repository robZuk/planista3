import { CLASS_FULL_LABELS, DAY_SHORT, ROOM_TYPE_LABELS } from './constants'

export function formatApiError(code: string, details?: Record<string, unknown>): string {
  switch (code) {
    case 'HOURS_EXCEEDED': {
      const d = details as { classType?: string; limit?: number; alreadyPlanned?: number; requested?: number; remaining?: number } | undefined
      const type = d?.classType ? (CLASS_FULL_LABELS[d.classType] ?? d.classType) : ''
      if ((d?.limit ?? 0) === 0) {
        return `Przedmiot nie ma godzin ${type ? `"${type}"` : 'tego typu'} w siatce — wybierz inny typ zajęć`
      }
      return `Przekroczono limit godzin${type ? ` (${type})` : ''} — zaplanowano już ${d?.alreadyPlanned ?? '?'}h z wymaganych ${d?.limit ?? '?'}h (pozostało ${d?.remaining ?? '?'}h, żądano ${d?.requested ?? '?'}h)`
    }
    case 'WRONG_ROOM_TYPE': {
      const d = details as { roomType?: string; classType?: string; allowed?: string[] } | undefined
      const roomType = d?.roomType ? (ROOM_TYPE_LABELS[d.roomType] ?? d.roomType) : '?'
      const classType = d?.classType ? (CLASS_FULL_LABELS[d.classType] ?? d.classType) : '?'
      const allowed = d?.allowed?.map(t => ROOM_TYPE_LABELS[t] ?? t).join(', ') ?? '?'
      return `Zły typ sali (${roomType}) — dla zajęć "${classType}" wymagana: ${allowed}`
    }
    case 'ROOM_CONFLICT': {
      const d = details as { dayOfWeek?: string; date?: string; startTime?: string; endTime?: string; roomNumber?: string; buildingName?: string } | undefined
      const when = d?.dayOfWeek ? (DAY_SHORT[d.dayOfWeek] ?? d.dayOfWeek) : (d?.date ? new Date(d.date).toLocaleDateString('pl-PL') : '?')
      const room = d?.roomNumber ? `sala ${d.roomNumber}${d.buildingName ? ` (${d.buildingName})` : ''}` : 'sala'
      return `Konflikt sali — ${room} jest zajęta: ${when} ${d?.startTime ?? ''}–${d?.endTime ?? ''}`
    }
    case 'INSTRUCTOR_CONFLICT': {
      const d = details as { dayOfWeek?: string; date?: string; startTime?: string; endTime?: string; instructorName?: string } | undefined
      const when = d?.dayOfWeek ? (DAY_SHORT[d.dayOfWeek] ?? d.dayOfWeek) : (d?.date ? new Date(d.date).toLocaleDateString('pl-PL') : '?')
      const name = d?.instructorName ?? 'prowadzący'
      return `Konflikt prowadzącego — ${name} jest zajęty: ${when} ${d?.startTime ?? ''}–${d?.endTime ?? ''}`
    }
    case 'GROUP_CONFLICT': {
      const d = details as { dayOfWeek?: string; date?: string; startTime?: string; endTime?: string; groupName?: string } | undefined
      const when = d?.dayOfWeek
        ? (DAY_SHORT[d.dayOfWeek] ?? d.dayOfWeek)
        : d?.date ? d.date.slice(0, 10).split('-').reverse().join('.') : '?'
      const group = d?.groupName ? `grupa ${d.groupName}` : 'grupa'
      return `Konflikt grupy — ${group} jest zajęta: ${when} ${d?.startTime ?? ''}–${d?.endTime ?? ''}`
    }
    case 'INSUFFICIENT_ROOM_CAPACITY': {
      const d = details as { roomCapacity?: number; groupSize?: number } | undefined
      return `Za mała sala — pojemność sali (${d?.roomCapacity ?? '?'} miejsc) jest mniejsza niż liczebność grupy (${d?.groupSize ?? '?'} os.)`
    }
    default: {
      const pl: Record<string, string> = {
        HOURS_EXCEEDED: 'Przekroczono limit godzin',
        WRONG_ROOM_TYPE: 'Zły typ sali',
        ROOM_CONFLICT: 'Sala zajęta',
        INSTRUCTOR_CONFLICT: 'Prowadzący zajęty',
        GROUP_CONFLICT: 'Grupa zajęta',
        NOT_FOUND: 'Nie znaleziono',
        CONFLICT: 'Konflikt',
      }
      return pl[code] ?? code
    }
  }
}
