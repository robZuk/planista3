import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarDays, Users, CheckCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { curriculumApi } from '@/api/curriculum'
import { groupsApi } from '@/api/groups'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function StatCard({
  title,
  value,
  icon,
  color = 'blue',
}: {
  title: string
  value: string | number
  icon: React.ReactNode
  color?: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const colorMap = {
    blue:   'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green:  'bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  }
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${colorMap[color]}`}>{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)

  const { data: versionsData } = useQuery({
    queryKey: ['curriculum-versions'],
    queryFn: () => curriculumApi.getVersions(),
    enabled: user?.role === 'ADMIN' || user?.role === 'DEAN_OFFICE',
  })

  const { data: groupsData } = useQuery({
    queryKey: ['groups-dashboard'],
    queryFn: () => groupsApi.getAll(),
    enabled: user?.role === 'ADMIN',
  })

  const versions = versionsData?.data.data ?? []
  const groups = groupsData?.data.data ?? []
  const activeVersions = versions.filter((v) => v.isActive)

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">
          Witaj, <span className="font-medium">{user?.name}</span>
        </p>
      </div>

      {(user?.role === 'ADMIN' || user?.role === 'DEAN_OFFICE') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Wersje planów"
            value={versions.length}
            icon={<BookOpen size={20} />}
            color="blue"
          />
          <StatCard
            title="Aktywne plany"
            value={activeVersions.length}
            icon={<CheckCircle size={20} />}
            color="green"
          />
          {user.role === 'ADMIN' && (
            <StatCard
              title="Grupy studentów"
              value={groups.length}
              icon={<Users size={20} />}
              color="purple"
            />
          )}
          <StatCard
            title="Rok akademicki"
            value="2024/2025"
            icon={<CalendarDays size={20} />}
            color="orange"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {versions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Aktywne siatki godzin</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeVersions.slice(0, 5).map((v) => (
                  <div key={v.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{v.specialization?.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.academicYear} · {v.studyMode === 'FULL_TIME' ? 'stacjonarne' : 'niestacjonarne'}
                      </p>
                    </div>
                    <span className="text-xs bg-green-500/15 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                      aktywna
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {user?.role === 'ADMIN' && groups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ostatnie grupy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {groups.slice(0, 6).map((g) => (
                  <div key={g.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{g.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Semestr {g.semester} · {g.academicYear}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{g.size} os.</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
