import { useMemo } from 'react'
import { getSettings, useSettings } from '../app/settings'
import type { Language } from '../types'
import ar from './ar.json'
import en from './en.json'

export type Dictionary = typeof en

/** Arabic must provide every key English has — checked at compile time here. */
const arabic: Dictionary = ar

const DICTIONARIES: Record<Language, Dictionary> = { en, ar: arabic }

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>
}[keyof T & string]

export type TranslationKey = Leaves<Dictionary>
export type PluralKey = keyof Dictionary['plurals']
export type TranslationParams = Record<string, string | number>

const numberFormats = new Map<Language, Intl.NumberFormat>()
const pluralRules = new Map<Language, Intl.PluralRules>()
const dateFormats = new Map<Language, Intl.DateTimeFormat>()

/** Western digits in both languages keep scores readable and consistent with the game canvas. */
const LOCALE: Record<Language, string> = { en: 'en-US', ar: 'ar-EG-u-nu-latn' }

export function formatNumber(language: Language, value: number): string {
  let format = numberFormats.get(language)
  if (!format) {
    format = new Intl.NumberFormat(LOCALE[language], { maximumFractionDigits: 1 })
    numberFormats.set(language, format)
  }
  return format.format(value)
}

export function formatDate(language: Language, timestamp: number): string {
  let format = dateFormats.get(language)
  if (!format) {
    format = new Intl.DateTimeFormat(LOCALE[language], { dateStyle: 'medium' })
    dateFormats.set(language, format)
  }
  return format.format(new Date(timestamp))
}

function lookup(dictionary: unknown, key: string): string | undefined {
  let node: unknown = dictionary
  for (const part of key.split('.')) {
    if (node !== null && typeof node === 'object' && part in node) node = (node as Record<string, unknown>)[part]
    else return undefined
  }
  return typeof node === 'string' ? node : undefined
}

export function interpolate(template: string, params: TranslationParams | undefined, language: Language): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    if (value === undefined) return match
    return typeof value === 'number' ? formatNumber(language, value) : value
  })
}

export function translate(language: Language, key: TranslationKey, params?: TranslationParams): string {
  const template = lookup(DICTIONARIES[language], key) ?? lookup(DICTIONARIES.en, key) ?? key
  return interpolate(template, params, language)
}

export function translatePlural(
  language: Language,
  key: PluralKey,
  count: number,
  params?: TranslationParams,
): string {
  let rules = pluralRules.get(language)
  if (!rules) {
    rules = new Intl.PluralRules(language)
    pluralRules.set(language, rules)
  }
  const forms = DICTIONARIES[language].plurals[key] as Record<string, string>
  const template = forms[rules.select(count)] ?? forms.other
  return interpolate(template, { count, ...params }, language)
}

export interface I18n {
  lang: Language
  dir: 'ltr' | 'rtl'
  t: (key: TranslationKey, params?: TranslationParams) => string
  tp: (key: PluralKey, count: number, params?: TranslationParams) => string
  num: (value: number) => string
  date: (timestamp: number) => string
}

export function createI18n(language: Language): I18n {
  return {
    lang: language,
    dir: language === 'ar' ? 'rtl' : 'ltr',
    t: (key, params) => translate(language, key, params),
    tp: (key, count, params) => translatePlural(language, key, count, params),
    num: (value) => formatNumber(language, value),
    date: (timestamp) => formatDate(language, timestamp),
  }
}

export function useI18n(): I18n {
  const language = useSettings((state) => state.language)
  return useMemo(() => createI18n(language), [language])
}

/** For code outside React (the game canvas): reads the current language. */
export function currentI18n(): I18n {
  return createI18n(getSettings().language)
}

export function dictionaryFor(language: Language): Dictionary {
  return DICTIONARIES[language]
}
