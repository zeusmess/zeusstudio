/**
 * True inside the Android app. Capacitor's native shell injects
 * window.Capacitor into its WebView; the web build itself never loads it.
 */
export function isNativeApp(): boolean {
  const capacitor = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return capacitor?.isNativePlatform?.() === true
}

/** True when the game runs inside another page (an iframe), which owns the browser's Back. */
export function isEmbedded(): boolean {
  try {
    return globalThis.self !== globalThis.top
  } catch {
    return true
  }
}
