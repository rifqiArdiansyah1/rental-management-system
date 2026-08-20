import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { LogoutButton } from '@/components/LogoutButton'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <nav className="bg-background dark:bg-background w-full top-0 sticky z-50 bg-background/80 backdrop-blur-md">
      <div className="flex justify-between items-center h-20 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        {/* Brand */}
        <Link href="/" className="font-display-lg text-headline-md tracking-tighter text-secondary dark:text-secondary-fixed cursor-pointer active:scale-95 transition-transform">
          Prestige Motion
        </Link>
        
        {/* Navigation Links (Desktop) */}
        <ul className="hidden md:flex items-center gap-8 font-label-caps text-label-caps">
          <li>
            <Link href="/" className="text-on-surface-variant hover:text-white transition-colors cursor-pointer active:scale-95 hover:text-secondary duration-300">
              Home
            </Link>
          </li>
          <li>
            <Link href="/#vehicles" className="text-on-surface-variant hover:text-white transition-colors cursor-pointer active:scale-95 hover:text-secondary duration-300">
              Vehicles
            </Link>
          </li>
          <li>
            <span className="text-on-surface-variant hover:text-white transition-colors cursor-pointer active:scale-95 hover:text-secondary duration-300">
              About
            </span>
          </li>
        </ul>
        
        {/* Trailing Action */}
        <div className="flex items-center gap-base">
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <Link href="/dashboard" className="font-button text-button text-background bg-secondary px-6 py-2 rounded-DEFAULT hover:bg-secondary-fixed transition-colors cursor-pointer active:scale-95 inline-block">
                  Dashboard
                </Link>
                <LogoutButton />
              </>
            ) : (
              <Link href="/login" className="font-button text-button text-secondary border border-secondary px-6 py-2 rounded-DEFAULT hover:bg-secondary hover:text-background transition-colors cursor-pointer active:scale-95 inline-block">
                Login
              </Link>
            )}
          </div>
          
          {/* Mobile Menu Toggle */}
          <button className="md:hidden text-on-surface">
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
