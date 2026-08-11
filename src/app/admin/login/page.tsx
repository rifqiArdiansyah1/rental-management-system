import { adminLogin } from './actions'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const validAdminRoles = ['staff_cabang', 'admin_cabang', 'admin_pusat']
    if (user.app_metadata && validAdminRoles.includes(user.app_metadata.role)) {
      redirect('/admin/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050b14]">
      <div className="max-w-md w-full space-y-8 p-8 bg-[#0a1220] rounded-2xl shadow-2xl border border-gray-800">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Admin Portal
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Sistem Manajemen Rental
          </p>
        </div>
        <form className="mt-8 space-y-6" action={adminLogin}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-700 placeholder-gray-500 text-white bg-[#121c2d] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] sm:text-sm"
                placeholder="Admin Email"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-700 placeholder-gray-500 text-white bg-[#121c2d] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-[#050b14] bg-[#d4af37] hover:bg-[#f1c40f] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a1220] focus:ring-[#d4af37] transition-all"
            >
              Secure Login
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
