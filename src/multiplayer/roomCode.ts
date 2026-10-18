/** Invitation codes: 6 characters from an alphabet without look-alikes (no 0/O, 1/I/L). */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
export const CODE_LENGTH = 6
export const CODE_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

export function generateRoomCode(random: (max: number) => number = secureRandomInt): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[random(CODE_ALPHABET.length)]
  return code
}

function secureRandomInt(max: number): number {
  const buffer = new Uint32Array(1)
  // Rejection sampling keeps every character equally likely.
  const limit = Math.floor(0x100000000 / max) * max
  do globalThis.crypto.getRandomValues(buffer)
  while (buffer[0] >= limit)
  return buffer[0] % max
}

/**
 * Cleans what a player typed: case, spaces and dashes are ignored, and digits
 * typed on an Arabic keyboard (٢٣٤…) are read as 2, 3, 4…
 */
export function normalizeRoomCode(input: string): string {
  let out = ''
  for (const char of input.normalize('NFKC')) {
    const arabic = ARABIC_INDIC_DIGITS.indexOf(char)
    const persian = PERSIAN_DIGITS.indexOf(char)
    if (arabic >= 0) out += String(arabic)
    else if (persian >= 0) out += String(persian)
    else if (/[\s\-_.]/u.test(char)) continue
    else out += char.toUpperCase()
  }
  return out
}

export function isValidRoomCode(code: string): boolean {
  return CODE_PATTERN.test(code)
}
