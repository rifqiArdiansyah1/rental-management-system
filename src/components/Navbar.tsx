import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { UserNavDropdown } from '@/components/UserNavDropdown'
import { MobileNav } from '@/components/MobileNav'
import LanguageSwitcher from '@/components/ui/LanguageSwitcher'
import { DesktopNavLinks, NavSignInLink } from '@/components/DesktopNavLinks'
import { getLocale, getDictionary } from '@/lib/i18n/server'

export default async function Navbar() {
  const [supabase, locale] = await Promise.all([
    createClient(),
    getLocale(),
  ])

  const [authResponse, dict] = await Promise.all([
    supabase.auth.getUser(),
    getDictionary(locale),
  ])

  const user = authResponse.data?.user

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
        <DesktopNavLinks initialNav={dict.nav} />
        
        {/* Desktop Trailing Action */}
        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
          <LanguageSwitcher />

          {userData ? (
            <UserNavDropdown user={userData} />
          ) : (
            <NavSignInLink initialLabel={dict.nav.signIn} />
          )}
        </div>

        {/* Mobile Navigation (Hamburger Drawer) */}
        <MobileNav user={userData} />
      </div>
    </nav>
  )
}
