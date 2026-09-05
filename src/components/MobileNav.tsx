'use client'

import { useState } from 'react'
import Link from 'next/link'
import { logout } from '@/actions/auth'

interface MobileNavProps {
  user: {
    id: string
    email?: string | null
    name?: string | null
    role?: string | null
  } | null
}

export function MobileNav({ user }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)

  const displayName = user?.name || user?.email?.split('@')[0] || 'User'
  const isAdmin = user?.role && ['admin_pusat', 'admin_cabang', 'staff_cabang'].includes(user.role)

  return (
    <div className="md:hidden flex items-center">
      {/* Hamburger Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Tutup navigasi' : 'Buka navigasi'}
        className="p-2 text-on-surface hover:text-secondary transition-colors cursor-pointer rounded-md focus:outline-none focus:ring-1 focus:ring-secondary min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <span className="material-symbols-outlined text-[26px]">
          {isOpen ? 'close' : 'menu'}
        </span>
      </button>

      {/* Mobile Drawer Sheet */}
      {isOpen && (
        <div className="fixed inset-x-0 top-20 bg-background/95 backdrop-blur-xl border-b border-surface-variant/40 shadow-2xl p-6 z-50 flex flex-col gap-6 animate-in slide-in-from-top duration-200">
          {/* Navigation Links */}
          <ul className="flex flex-col gap-4 font-label-caps text-sm tracking-wider uppercase font-medium">
            <li>
              <Link 
                href="/" 
                onClick={() => setIsOpen(false)}
                className="text-on-surface hover:text-secondary transition-colors block py-1"
              >
                Home
              </Link>
            </li>
            <li>
              <Link 
                href="/#vehicles" 
                onClick={() => setIsOpen(false)}
                className="text-on-surface hover:text-secondary transition-colors block py-1"
              >
                Armada
              </Link>
            </li>
            <li>
              <Link 
                href="/locations" 
                onClick={() => setIsOpen(false)}
                className="text-on-surface hover:text-secondary transition-colors block py-1"
              >
                Cabang
              </Link>
            </li>
            <li>
              <Link 
                href="/about" 
                onClick={() => setIsOpen(false)}
                className="text-on-surface hover:text-secondary transition-colors block py-1"
              >
                Tentang
              </Link>
            </li>
            <li>
              <Link 
                href="/contact" 
                onClick={() => setIsOpen(false)}
                className="text-on-surface hover:text-secondary transition-colors block py-1"
              >
                Kontak
              </Link>
            </li>
          </ul>

          <div className="border-t border-surface-variant/30 pt-4">
            {user ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-secondary/20 text-secondary border border-secondary/40 font-semibold flex items-center justify-center text-xs">
                    {(user.name?.[0] || user.email?.[0] || 'U').toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                    <p className="text-[11px] text-on-surface-variant truncate font-mono">{user.email}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Link
                    href="/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="w-full text-center bg-surface-container-high border border-outline-variant/40 text-secondary font-button text-xs tracking-wider uppercase font-semibold py-2.5 rounded-DEFAULT hover:border-secondary/60 transition-colors"
                  >
                    Dashboard Saya
                  </Link>

                  {isAdmin && (
                    <Link
                      href="/admin/dashboard"
                      onClick={() => setIsOpen(false)}
                      className="w-full text-center bg-surface-container border border-outline-variant/40 text-amber-400 font-button text-xs tracking-wider uppercase font-semibold py-2.5 rounded-DEFAULT hover:border-amber-400/60 transition-colors"
                    >
                      Portal Manajemen Admin
                    </Link>
                  )}

                  <button
                    onClick={() => {
                      setIsOpen(false)
                      logout()
                    }}
                    className="w-full text-center text-error/90 hover:text-error hover:bg-error/10 font-button text-xs tracking-wider uppercase font-semibold py-2 rounded-DEFAULT transition-colors cursor-pointer"
                  >
                    Keluar (Logout)
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={() => setIsOpen(false)}
                className="w-full text-center block font-button text-xs tracking-wide uppercase font-semibold text-secondary border border-secondary/60 px-5 py-2.5 rounded-DEFAULT hover:bg-secondary hover:text-background transition-colors"
              >
                Masuk
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
