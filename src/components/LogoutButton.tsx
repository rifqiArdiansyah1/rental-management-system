'use client'

import { logout } from '@/actions/auth'

export function LogoutButton() {
  return (
    <button 
      onClick={() => logout()}
      style={{
        backgroundColor: '#32343e', // surface_container_highest
        color: '#b3c5ff',           // primary
        borderRadius: '0.375rem',   // md
      }}
      className="font-button text-sm px-5 py-2 transition-all cursor-pointer active:scale-95 inline-block hover:opacity-80"
    >
      Logout
    </button>
  )
}
