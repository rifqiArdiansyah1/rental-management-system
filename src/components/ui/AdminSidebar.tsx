'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarRange, Car, LogOut, Users, Building2, Menu, X } from 'lucide-react'

type AdminSidebarProps = {
  userRole: string;
  handleLogout: () => void;
}

export default function AdminSidebar({ userRole, handleLogout }: AdminSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Auto-close sidebar on path change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  const navLinks = [
    { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/admin/bookings', icon: CalendarRange, label: 'Manajemen Pesanan' },
    { href: '/admin/vehicles', icon: Car, label: 'Manajemen Armada' },
    { href: '/admin/drivers', icon: Users, label: 'Manajemen Sopir' },
    ...(userRole === 'admin_pusat' ? [{ href: '/admin/branches', icon: Building2, label: 'Manajemen Cabang' }] : []),
  ]

  return (
    <>
      {/* Mobile Header & Hamburger Toggle */}
      <div className="lg:hidden flex items-center justify-between bg-zinc-900 text-zinc-100 p-4 shrink-0">
        <h2 className="text-xl font-bold tracking-tight">Prestige Admin</h2>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 -mr-2 text-zinc-400 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Toggle Menu"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-64 bg-zinc-900 text-zinc-100 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-6 hidden lg:block">
          <h2 className="text-2xl font-bold tracking-tight">Prestige Admin</h2>
          <p className="text-sm text-zinc-400 mt-1 capitalize">{userRole}</p>
        </div>

        {/* Mobile only role display */}
        <div className="p-6 lg:hidden border-b border-zinc-800">
          <p className="text-sm text-zinc-400 capitalize">Login sebagai: <strong className="text-zinc-200">{userRole}</strong></p>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors min-h-[44px] ${isActive ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-white font-medium'
                  }`}
              >
                <link.icon className={`w-5 h-5 ${isActive ? 'text-zinc-200' : 'text-zinc-400'}`} />
                <span>{link.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-zinc-800 shrink-0">
          <form action={handleLogout}>
            <button
              type="submit"
              className="flex items-center gap-3 px-4 py-3 w-full rounded-md text-red-400 hover:bg-red-500/10 transition-colors text-left min-h-[44px]"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Keluar</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
