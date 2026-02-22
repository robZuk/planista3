import { NavLink } from 'react-router-dom'
import { LayoutDashboard, BookOpen, CalendarDays, Users, LogOut, Sun, Moon } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTheme } from '@/hooks/useTheme'
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
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const { theme, toggle } = useTheme()

  const visibleItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  )

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-gray-900 text-gray-100 dark:bg-gray-950 dark:border-r dark:border-gray-800">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700 dark:border-gray-800">
        <div>
          <h1 className="text-lg font-bold text-white">Planista</h1>
          <p className="text-xs text-gray-400 mt-0.5">UMG</p>
        </div>
        <button
          onClick={toggle}
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          title={theme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              )
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-gray-700 dark:border-gray-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-white truncate">{user?.name}</p>
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          <p className="text-xs text-blue-400 mt-0.5">{user?.role}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Wyloguj
        </button>
      </div>
    </aside>
  )
}
