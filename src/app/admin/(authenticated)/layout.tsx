import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/ui/AdminSidebar'

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
    <div className="flex flex-col lg:flex-row h-screen bg-zinc-100 overflow-hidden">
      <AdminSidebar userRole={user.app_metadata.role.replace('_', ' ')} handleLogout={handleLogout} />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
