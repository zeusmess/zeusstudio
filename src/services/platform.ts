/**
 * True inside the Android app. Capacitor's native shell injects
 * window.Capacitor into its WebView; the web build itself never loads it.
 */
export function isNativeApp(): boolean {
  const capacitor = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return capacitor?.isNativePlatform?.() === true
}
