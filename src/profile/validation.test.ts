import { NAME_MAX, validateDisplayName } from './validation'

const hidden = (code: number) => String.fromCharCode(code)

describe('display names', () => {
  it.each(['Youssef Ayman', 'يوسف أيمن', 'يُوسُف', 'Barista_7', 'Youssef يوسف', 'Mo.Salah-11'])('accepts %s', (name) => {
    expect(validateDisplayName(name)).toEqual({ ok: true, value: name })
  })

  it('tidies spaces', () => {
    expect(validateDisplayName('  Youssef    Ayman ')).toEqual({ ok: true, value: 'Youssef Ayman' })
  })

  it('counts Arabic letters with their marks as single characters', () => {
    const vowelled = 'يُوسُفُ'.repeat(3)
    expect(validateDisplayName(vowelled).ok).toBe(true)
    expect([...vowelled].length).toBeGreaterThan(NAME_MAX)
  })

  it('explains why a name is refused', () => {
    expect(validateDisplayName('')).toEqual({ ok: false, error: 'empty' })
    expect(validateDisplayName('   ')).toEqual({ ok: false, error: 'empty' })
    expect(validateDisplayName('Y')).toEqual({ ok: false, error: 'tooShort' })
    expect(validateDisplayName('x'.repeat(NAME_MAX + 1))).toEqual({ ok: false, error: 'tooLong' })
    expect(validateDisplayName('<script>')).toEqual({ ok: false, error: 'invalid' })
    expect(validateDisplayName('..--')).toEqual({ ok: false, error: 'invalid' })
    expect(validateDisplayName('Coffee ☕')).toEqual({ ok: false, error: 'invalid' })
  })

  it('refuses invisible characters that could disguise a name', () => {
    expect(validateDisplayName(`Yo${hidden(0x200b)}ussef`)).toEqual({ ok: false, error: 'invalid' })
    expect(validateDisplayName(`${hidden(0x202e)}fessuoY`)).toEqual({ ok: false, error: 'invalid' })
    expect(validateDisplayName(`Youssef${hidden(0x2066)}`)).toEqual({ ok: false, error: 'invalid' })
  })
})
