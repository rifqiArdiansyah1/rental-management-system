'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface NavDict {
  home: string
  fleet: string
  locations: string
  about: string
  contact: string
}

export function DesktopNavLinks({ initialNav }: { initialNav: NavDict }) {
  const { t } = useLanguage()
  const nav = t?.nav || initialNav

  return (
    <ul className="hidden md:flex items-center gap-4 lg:gap-7 font-label-caps text-xs tracking-wider uppercase font-medium">
      <li>
        <Link href="/" className="text-on-surface-variant hover:text-secondary transition-colors cursor-pointer duration-200">
          {nav.home}
        </Link>
      </li>
      <li>
        <Link href="/#vehicles" className="text-on-surface-variant hover:text-secondary transition-colors cursor-pointer duration-200">
          {nav.fleet}
        </Link>
      </li>
      <li>
        <Link href="/locations" className="text-on-surface-variant hover:text-secondary transition-colors cursor-pointer duration-200">
          {nav.locations}
        </Link>
      </li>
      <li>
        <Link href="/about" className="text-on-surface-variant hover:text-secondary transition-colors cursor-pointer duration-200">
          {nav.about}
        </Link>
      </li>
      <li>
        <Link href="/contact" className="text-on-surface-variant hover:text-secondary transition-colors cursor-pointer duration-200">
          {nav.contact}
        </Link>
      </li>
    </ul>
  )
}

export function NavSignInLink({ initialLabel }: { initialLabel: string }) {
  const { t } = useLanguage()
  return (
    <Link 
      href="/login" 
      className="font-button text-xs tracking-wide uppercase font-semibold text-secondary border border-secondary/60 px-5 py-2.5 rounded-DEFAULT hover:bg-secondary hover:text-background transition-colors cursor-pointer inline-block"
    >
      {t?.nav?.signIn || initialLabel}
    </Link>
  )
}
