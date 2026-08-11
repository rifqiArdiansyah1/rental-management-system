import Link from 'next/link'
import { LayoutDashboard, CalendarRange, Car, LogOut } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  // Handle Logout via Server Action
  const handleLogout = async () => {
    'use server'
    const s = await createClient()
    await s.auth.signOut()
    redirect('/admin/login')
  }

  return (
    <div className="flex h-screen bg-zinc-100">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 text-zinc-100 flex flex-col">
        <div className="p-6">
          <h2 className="text-2xl font-bold tracking-tight">Prestige Admin</h2>
          <p className="text-sm text-zinc-400 mt-1 capitalize">{user.app_metadata.role.replace('_', ' ')}</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-zinc-800 transition-colors">
            <LayoutDashboard className="w-5 h-5 text-zinc-400" />
            <span className="font-medium">Dashboard</span>
          </Link>
          <Link href="/admin/bookings" className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-zinc-800 transition-colors">
            <CalendarRange className="w-5 h-5 text-zinc-400" />
            <span className="font-medium">Manajemen Pesanan</span>
          </Link>
          <Link href="/admin/vehicles" className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-zinc-800 transition-colors">
            <Car className="w-5 h-5 text-zinc-400" />
            <span className="font-medium">Status Armada</span>
          </Link>
        </nav>

        <div className="p-4 mt-auto border-t border-zinc-800">
          <form action={handleLogout}>
            <button type="submit" className="flex items-center gap-3 px-4 py-3 w-full rounded-md text-red-400 hover:bg-red-500/10 transition-colors text-left">
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Keluar</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
