'use client'

import { logout } from '@/actions/auth'

export function LogoutButton() {
  return (
    <button 
      onClick={() => logout()}
      className="font-button text-xs tracking-wider uppercase font-semibold text-error/90 hover:text-error hover:bg-error/10 px-4 py-2 rounded-DEFAULT transition-all cursor-pointer inline-block"
    >
      Keluar
    </button>
  )
}
