import { NavLink } from 'react-router-dom'
import { LayoutDashboard, BookOpen, CalendarDays, Users, GraduationCap, Building2, School, LogOut, Sun, Moon } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useAcademicYearStore, ACADEMIC_YEARS } from '@/store/academicYearStore'
import { useTheme } from '@/hooks/useTheme'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Role } from '@/types'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  roles: Role[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: <LayoutDashboard size={18} />,
    roles: ['ADMIN', 'INSTRUCTOR', 'STUDENT', 'DEAN_OFFICE'],
  },
  {
    label: 'Siatka godzin',
    path: '/curriculum',
    icon: <BookOpen size={18} />,
    roles: ['ADMIN', 'DEAN_OFFICE', 'INSTRUCTOR'],
  },
  {
    label: 'Plan zajęć',
    path: '/schedule',
    icon: <CalendarDays size={18} />,
    roles: ['ADMIN', 'INSTRUCTOR', 'STUDENT', 'DEAN_OFFICE'],
  },
  {
    label: 'Grupy',
    path: '/groups',
    icon: <Users size={18} />,
    roles: ['ADMIN'],
  },
  {
    label: 'Prowadzący',
    path: '/instructors',
    icon: <GraduationCap size={18} />,
    roles: ['ADMIN', 'DEAN_OFFICE', 'INSTRUCTOR'],
  },
  {
    label: 'Budynki i sale',
    path: '/buildings',
    icon: <Building2 size={18} />,
    roles: ['ADMIN', 'DEAN_OFFICE'],
  },
  {
    label: 'Wydziały',
    path: '/faculties',
    icon: <School size={18} />,
    roles: ['ADMIN', 'DEAN_OFFICE'],
  },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const { theme, toggle } = useTheme()
  const { academicYear, setAcademicYear, semesterType, setSemesterType } = useAcademicYearStore()
  const contextValue = `${academicYear}|${semesterType}`
  const handleContextChange = (val: string) => {
    const [year, type] = val.split('|')
    if (year) setAcademicYear(year)
    if (type === 'WINTER' || type === 'SUMMER') setSemesterType(type)
  }

  const visibleItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  )

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-card border-r border-border text-card-foreground">
      <div className="flex items-center justify-between px-6 py-5 border-b border-border">
        <div>
          <h1 className="text-lg font-bold text-foreground">Planista</h1>
          <p className="text-xs text-muted-foreground mt-0.5">UMG</p>
        </div>
        <button
          onClick={toggle}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title={theme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Kontekst</p>
        <Select value={contextValue} onValueChange={handleContextChange}>
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACADEMIC_YEARS.flatMap((y) => [
              <SelectItem key={`${y}|WINTER`} value={`${y}|WINTER`}>{y} — zimowy</SelectItem>,
              <SelectItem key={`${y}|SUMMER`} value={`${y}|SUMMER`}>{y} — letni</SelectItem>,
            ])}
          </SelectContent>
        </Select>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-border">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          <p className="text-xs text-primary mt-0.5">{user?.role}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut size={18} />
          Wyloguj
        </button>
      </div>
    </aside>
  )
}
