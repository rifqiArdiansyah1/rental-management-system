'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { logout } from '@/actions/auth'

interface UserNavDropdownProps {
  user: {
    id: string
    email?: string | null
    name?: string | null
    role?: string | null
  }
}

export function UserNavDropdown({ user }: UserNavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const displayName = user.name || user.email?.split('@')[0] || 'User'
  const initial = (user.name?.[0] || user.email?.[0] || 'U').toUpperCase()
  const isAdmin = user.role && ['admin_pusat', 'admin_cabang', 'staff_cabang'].includes(user.role)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Menu profil pengguna"
        className="bg-surface-container-high border border-outline-variant/40 hover:border-secondary/50 text-on-surface px-3 py-1.5 rounded-full flex items-center gap-2.5 transition-all cursor-pointer focus:outline-none focus:ring-1 focus:ring-secondary active:scale-95"
      >
        {/* Avatar circle */}
        <div className="w-7 h-7 rounded-full bg-secondary/20 text-secondary border border-secondary/40 font-semibold flex items-center justify-center text-xs flex-shrink-0">
          {initial}
        </div>
        
        {/* User name */}
        <span className="text-xs font-medium text-on-surface max-w-[110px] truncate hidden sm:inline-block">
          {displayName}
        </span>

        {/* Chevron */}
        <span className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-64 bg-surface-container-high/95 backdrop-blur-md border border-outline-variant/40 rounded-xl shadow-2xl py-2 text-on-surface z-50 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Header Info */}
          <div className="px-4 py-2.5 border-b border-surface-variant/30">
            <p className="text-xs font-semibold text-white truncate">
              {user.name || displayName}
            </p>
            <p className="text-[11px] text-on-surface-variant truncate font-mono">
              {user.email}
            </p>
          </div>

          {/* Links */}
          <div className="py-1">
            <Link
              href="/dashboard"
              onClick={() => setIsOpen(false)}
              role="menuitem"
              className="px-4 py-2 text-xs flex items-center gap-2.5 text-on-surface hover:text-secondary hover:bg-surface-container transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-secondary">dashboard</span>
              <span>Dashboard Saya</span>
            </Link>

            {isAdmin && (
              <Link
                href="/admin/dashboard"
                onClick={() => setIsOpen(false)}
                role="menuitem"
                className="px-4 py-2 text-xs flex items-center gap-2.5 text-on-surface hover:text-secondary hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px] text-amber-400">admin_panel_settings</span>
                <span>Portal Manajemen Admin</span>
              </Link>
            )}
          </div>

          <div className="border-t border-surface-variant/30 my-1"></div>

          {/* Logout Action */}
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false)
                logout()
              }}
              role="menuitem"
              className="w-full text-left px-4 py-2 text-xs flex items-center gap-2.5 text-error/90 hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>Keluar (Logout)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
