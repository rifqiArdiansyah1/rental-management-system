'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Locale } from '@/lib/i18n/types'

export async function setLocalePreference(newLocale: Locale) {
  const cookieStore = await cookies()
  cookieStore.set('NEXT_LOCALE', newLocale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  revalidatePath('/', 'layout')
}
