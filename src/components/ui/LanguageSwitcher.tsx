'use client'

import React from 'react'
import { Globe } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface LanguageSwitcherProps {
  className?: string
  variant?: 'nav' | 'footer' | 'mobile'
}

export default function LanguageSwitcher({
  className = '',
  variant = 'nav',
}: LanguageSwitcherProps) {
  const { locale, setLocale, isSwitching } = useLanguage()

  const handleSelect = (newLocale: 'id' | 'en') => {
    if (newLocale !== locale) {
      setLocale(newLocale)
    }
  }

  if (variant === 'footer') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`} data-testid="language-switcher-footer">
        <Globe className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-400 mr-1">Bahasa:</span>
        <div className="inline-flex rounded-md border border-white/10 p-0.5 bg-black/30 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => handleSelect('id')}
            disabled={isSwitching}
            data-testid="lang-option-id"
            className={`px-2 py-0.5 text-xs rounded font-medium transition-all ${
              locale === 'id'
                ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ID
          </button>
          <button
            type="button"
            onClick={() => handleSelect('en')}
            disabled={isSwitching}
            data-testid="lang-option-en"
            className={`px-2 py-0.5 text-xs rounded font-medium transition-all ${
              locale === 'en'
                ? 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            EN
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 backdrop-blur-md p-1 shadow-inner ${className}`}
      data-testid="language-switcher"
    >
      <Globe className="w-3.5 h-3.5 text-gray-400 ml-1.5" />
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => handleSelect('id')}
          disabled={isSwitching}
          data-testid="lang-option-id"
          className={`px-2 py-1 text-xs rounded-full font-medium transition-all duration-200 ${
            locale === 'id'
              ? 'bg-[#d4af37] text-black font-semibold shadow-[0_0_12px_rgba(212,175,55,0.4)]'
              : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
          aria-label="Ganti ke Bahasa Indonesia"
        >
          ID
        </button>
        <button
          type="button"
          onClick={() => handleSelect('en')}
          disabled={isSwitching}
          data-testid="lang-option-en"
          className={`px-2 py-1 text-xs rounded-full font-medium transition-all duration-200 ${
            locale === 'en'
              ? 'bg-[#d4af37] text-black font-semibold shadow-[0_0_12px_rgba(212,175,55,0.4)]'
              : 'text-gray-300 hover:text-white hover:bg-white/5'
          }`}
          aria-label="Switch to English"
        >
          EN
        </button>
      </div>
    </div>
  )
}
