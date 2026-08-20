'use client'

import { logout } from '@/actions/auth'

export function LogoutButton() {
  return (
    <button 
      onClick={() => logout()}
      className="font-button text-button text-error border border-error px-6 py-2 rounded-DEFAULT hover:bg-error hover:text-white transition-colors cursor-pointer active:scale-95 inline-block"
    >
      Logout
    </button>
  )
}
