import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Plus, Pencil, Check, X } from 'lucide-react'
import { scheduleApi } from '@/api/schedule'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PublicHoliday } from '@/types'

export function HolidaysPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'ADMIN'
  const qc = useQueryClient()

  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['holidays-all'],
    queryFn: () => scheduleApi.getHolidays(),
  })
  const holidays: PublicHoliday[] = data?.data.data ?? []

  const addMutation = useMutation({
    mutationFn: () => scheduleApi.createHoliday({ date, name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays-all'] })
      qc.invalidateQueries({ queryKey: ['holidays'] })
      setDate('')
      setName('')
      setError('')
    },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Błąd')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      scheduleApi.updateHoliday(id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays-all'] })
      qc.invalidateQueries({ queryKey: ['holidays'] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scheduleApi.deleteHoliday(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays-all'] })
      qc.invalidateQueries({ queryKey: ['holidays'] })
    },
  })

  const byYear = holidays.reduce<Record<string, PublicHoliday[]>>((acc, h) => {
    const year = h.date.slice(0, 4)
    if (!acc[year]) acc[year] = []
    acc[year]!.push(h)
    return acc
  }, {})
  const years = Object.keys(byYear).sort((a, b) => b.localeCompare(a))

  const fmtDate = (d: string) =>
    new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('pl-PL', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    })

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Dni wolne</h1>

      {isAdmin && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">Dodaj dzień wolny</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nazwa</Label>
              <Input
                placeholder="np. Boże Narodzenie"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && date && name && addMutation.mutate()}
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            size="sm"
            onClick={() => addMutation.mutate()}
            disabled={!date || !name || addMutation.isPending}
          >
            <Plus className="size-4 mr-1" />
            {addMutation.isPending ? 'Dodawanie...' : 'Dodaj'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Ładowanie...</p>
      ) : holidays.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak zdefiniowanych dni wolnych.</p>
      ) : (
        <div className="space-y-5">
          {years.map(year => (
            <div key={year}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{year}</p>
              <div className="rounded-lg border border-border divide-y divide-border">
                {byYear[year]!.map(h => (
                  <div key={h.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <div className="flex-1 min-w-0">
                      {editingId === h.id ? (
                        <Input
                          className="h-7 text-sm"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && editingName.trim()) updateMutation.mutate({ id: h.id, name: editingName.trim() })
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          autoFocus
                        />
                      ) : (
                        <p className="text-sm font-medium truncate">{h.name}</p>
                      )}
                      <p className="text-xs text-muted-foreground capitalize">{fmtDate(h.date)}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        {editingId === h.id ? (
                          <>
                            <Button
                              variant="ghost" size="sm"
                              className="text-green-600 hover:text-green-600 hover:bg-green-500/10"
                              disabled={!editingName.trim() || updateMutation.isPending}
                              onClick={() => updateMutation.mutate({ id: h.id, name: editingName.trim() })}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => { setEditingId(h.id); setEditingName(h.name) }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deleteMutation.isPending}
                              onClick={() => deleteMutation.mutate(h.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
