// Dates for the daily top 10 follow Cairo time, whatever the device's zone.

const cairoFormat = (() => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return null
  }
})()

/** "2026-10-19" in Africa/Cairo */
export function cairoDateKey(date = new Date()) {
  if (cairoFormat) return cairoFormat.format(date)
  // Very old engines without time zone data: Egypt is UTC+2 (UTC+3 in summer time).
  const shifted = new Date(date.getTime() + 2 * 3600 * 1000)
  return shifted.toISOString().slice(0, 10)
}

export function formatRelativeArabic(timestamp, now = Date.now()) {
  if (!timestamp) return '—'
  const diff = Math.max(0, now - timestamp)
  const min = Math.floor(diff / 60000)
  if (min < 2) return 'نشط الآن'
  if (min < 60) return `منذ ${min} دقيقة`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `منذ ${hours} ساعة`
  const days = Math.floor(hours / 24)
  if (days < 30) return `منذ ${days} يوم`
  return new Date(timestamp).toLocaleDateString('ar-EG')
}
