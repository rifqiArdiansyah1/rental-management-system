'use client'

import React, { createContext, useContext, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Locale, DEFAULT_LOCALE } from './types'
import { id, Dictionary } from '@/locales/id'
import { en } from '@/locales/en'
import { formatCurrency as formatCurrencyUtil, formatDate as formatDateUtil } from './formatters'
import { setLocalePreference } from '@/actions/locale'

interface LanguageContextType {
  locale: Locale
  setLocale: (newLocale: Locale) => void
  t: Dictionary
  isSwitching: boolean
  formatCurrency: (amount: number | bigint | string) => string
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string
}

const dictionaries: Record<Locale, Dictionary> = {
  id,
  en,
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({
  initialLocale = DEFAULT_LOCALE,
  children,
}: {
  initialLocale?: Locale
  children: React.ReactNode
}) {
  const router = useRouter()
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const [isPending, startTransition] = useTransition()

  React.useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=(id|en)(?:;|$)/)
    if (match && match[1] && (match[1] === 'id' || match[1] === 'en')) {
      if (match[1] !== locale) {
        setLocaleState(match[1] as Locale)
      }
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    if (newLocale === locale) return

    // 1. Set cookie for next server requests & Server Components
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`

    // 2. Update client React state immediately
    setLocaleState(newLocale)

    // 3. Trigger Server Action to revalidate layout tree and refresh
    startTransition(async () => {
      await setLocalePreference(newLocale)
      router.refresh()
    })
  }

  const t = dictionaries[locale] || dictionaries.id

  const formatCurrency = (amount: number | bigint | string) => {
    return formatCurrencyUtil(amount, locale)
  }

  const formatDate = (date: Date | string, options?: Intl.DateTimeFormatOptions) => {
    return formatDateUtil(date, locale, options)
  }

  return (
    <LanguageContext.Provider
      value={{
        locale,
        setLocale,
        t,
        isSwitching: isPending,
        formatCurrency,
        formatDate,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    // Fallback if rendered outside provider
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: id,
      isSwitching: false,
      formatCurrency: (amount: number | bigint | string) => formatCurrencyUtil(amount, DEFAULT_LOCALE),
      formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => formatDateUtil(date, DEFAULT_LOCALE, options),
    }
  }
  return context
}
