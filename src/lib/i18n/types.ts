export type Locale = 'id' | 'en'

export const DEFAULT_LOCALE: Locale = 'id'

export const LOCALES: Locale[] = ['id', 'en']

export function isValidLocale(locale: any): locale is Locale {
  return locale === 'id' || locale === 'en'
}
