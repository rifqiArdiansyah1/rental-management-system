'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function AuthNotifier() {
  const [showToast, setShowToast] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const supabase = createClient()

    if (!supabase) {
      const urlParams = new URLSearchParams(window.location.search)
      if (urlParams.get('verified') === 'true') {
        setMessage('Akun berhasil diverifikasi!')
        setShowToast(true)
        setTimeout(() => setShowToast(false), 5000)
      }
      return
    }

    // Listen to Supabase Auth state changes (e.g. when picking up a token from the URL after email confirmation)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION occurs on load. If there is a hash with type=signup or access_token, 
      // Supabase processes it. SIGNED_IN happens right after.
      // We can check if the URL hash contains access_token to show the specific verification message.
      if (event === 'SIGNED_IN') {
        const hash = window.location.hash
        if (hash && hash.includes('type=signup')) {
          setMessage('Akun berhasil diverifikasi dan diotentikasi!')
          setShowToast(true)
          
          // Clear the hash so we don't show it again on refresh
          // (Supabase usually clears it automatically, but just in case)
          setTimeout(() => setShowToast(false), 5000)
        } else if (hash && hash.includes('access_token')) {
          setMessage('Autentikasi berhasil!')
          setShowToast(true)
          setTimeout(() => setShowToast(false), 5000)
        }
      }
    })

    // Also just a fallback: if we are redirected to a URL with ?verified=true or similar
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('verified') === 'true') {
      setMessage('Akun berhasil diverifikasi!')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 5000)
    }

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (!showToast) return null

  return (
    <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-5 fade-in duration-500">
      <div 
        style={{
          backgroundColor: 'rgba(54, 57, 67, 0.6)', // surface_bright (#363943) at 60% opacity
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(66, 70, 86, 0.15)', // outline_variant (#424656) at 15%
          boxShadow: '0 20px 60px rgba(11, 14, 22, 0.4)', // surface_container_lowest (#0b0e16) at 40%
        }}
        className="px-6 py-4 rounded-xl flex items-center gap-4 max-w-sm"
      >
        <div 
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #0066ff, #284386)' // primary_container to on_secondary_fixed_variant
          }}
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p style={{ color: '#e1e2ee', letterSpacing: '-0.02em' }} className="text-sm font-semibold tracking-tight">
            Autentikasi Berhasil
          </p>
          <p style={{ color: '#c2c6d8' }} className="text-xs mt-0.5">
            {message}
          </p>
        </div>
      </div>
    </div>
  )
}
