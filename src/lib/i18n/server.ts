import { cookies, headers } from 'next/headers'
import { Locale, DEFAULT_LOCALE } from './types'
import { id, Dictionary } from '@/locales/id'
import { en } from '@/locales/en'

const dictionaries: Record<Locale, Dictionary> = {
  id,
  en,
}

export async function getLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies()
    const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value as Locale
    if (cookieLocale === 'en' || cookieLocale === 'id') {
      return cookieLocale
    }

    const headerList = await headers()
    const headerLocale = headerList.get('x-locale') as Locale
    if (headerLocale === 'en' || headerLocale === 'id') {
      return headerLocale
    }
  } catch {
    // Fallback if accessed outside request context
  }

  return DEFAULT_LOCALE
}

export async function getDictionary(locale?: Locale): Promise<Dictionary> {
  const currentLocale = locale || (await getLocale())
  return dictionaries[currentLocale] || dictionaries.id
}
