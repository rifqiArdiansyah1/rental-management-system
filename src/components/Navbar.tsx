import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { UserNavDropdown } from '@/components/UserNavDropdown'
import { MobileNav } from '@/components/MobileNav'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const userData = user ? {
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || null,
    role: (user.app_metadata?.role as string) || null
  } : null

  return (
    <nav className="bg-background/90 sticky top-0 z-50 w-full backdrop-blur-md border-b border-surface-variant/30">
      <div className="flex justify-between items-center h-20 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        {/* Brand */}
        <Link 
          href="/" 
          className="font-display-lg text-headline-md tracking-tighter text-secondary cursor-pointer active:scale-95 transition-transform flex-shrink-0"
        >
          Prestige Motion
        </Link>
        
        {/* Navigation Links (Desktop/Tablet) */}
        <ul className="hidden md:flex items-center gap-4 lg:gap-7 font-label-caps text-xs tracking-wider uppercase font-medium">
          <li>
            <Link href="/" className="text-on-surface-variant hover:text-secondary transition-colors cursor-pointer duration-200">
              Home
            </Link>
          </li>
          <li>
            <Link href="/#vehicles" className="text-on-surface-variant hover:text-secondary transition-colors cursor-pointer duration-200">
              Armada
            </Link>
          </li>
          <li>
            <Link href="/locations" className="text-on-surface-variant hover:text-secondary transition-colors cursor-pointer duration-200">
              Cabang
            </Link>
          </li>
          <li>
            <Link href="/about" className="text-on-surface-variant hover:text-secondary transition-colors cursor-pointer duration-200">
              Tentang
            </Link>
          </li>
          <li>
            <Link href="/contact" className="text-on-surface-variant hover:text-secondary transition-colors cursor-pointer duration-200">
              Kontak
            </Link>
          </li>
        </ul>
        
        {/* Desktop Trailing Action */}
        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
          {userData ? (
            <UserNavDropdown user={userData} />
          ) : (
            <Link 
              href="/login" 
              className="font-button text-xs tracking-wide uppercase font-semibold text-secondary border border-secondary/60 px-5 py-2.5 rounded-DEFAULT hover:bg-secondary hover:text-background transition-colors cursor-pointer inline-block"
            >
              Masuk
            </Link>
          )}
        </div>

        {/* Mobile Navigation (Hamburger Drawer) */}
        <MobileNav user={userData} />
      </div>
    </nav>
  )
}
