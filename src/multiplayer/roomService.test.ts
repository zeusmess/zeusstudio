import { FirebaseNotConfiguredError } from '../auth/firebase'
import { OnlineUnavailableError } from '../auth/authService'
import { createRoom, joinRoom, parseMeta, RoomError, toRoomError } from './roomService'

const ME = { name: 'Youssef', avatar: 'hot-cup' as const }

describe('room service without a configured backend', () => {
  it('says online play awaits configuration instead of pretending to create a room', async () => {
    await expect(createRoom('classic', ME)).rejects.toMatchObject({ code: 'unconfigured' })
  })

  it('checks the code before going online', async () => {
    await expect(joinRoom('AB', ME)).rejects.toMatchObject({ code: 'invalidCode' })
    await expect(joinRoom('ABCDE0', ME)).rejects.toMatchObject({ code: 'invalidCode' })
    await expect(joinRoom('k7m-2qx', ME)).rejects.toMatchObject({ code: 'unconfigured' })
  })
})

describe('turning failures into messages', () => {
  it('maps every kind of failure to a code the lobby can explain', () => {
    expect(toRoomError(new OnlineUnavailableError('unconfigured')).code).toBe('unconfigured')
    expect(toRoomError(new OnlineUnavailableError('auth')).code).toBe('auth')
    expect(toRoomError(new FirebaseNotConfiguredError(['VITE_FIREBASE_API_KEY'])).code).toBe('unconfigured')
    expect(toRoomError(Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' })).code).toBe('permission')
    expect(toRoomError(new Error('Client is offline.')).code).toBe('network')
    expect(toRoomError(new Error('boom')).code).toBe('generic')
    const known = new RoomError('full')
    expect(toRoomError(known)).toBe(known)
  })
})

describe('reading room data from the network', () => {
  const valid = { hostUid: 'h', status: 'waiting', length: 'quick', seed: 5, round: 1, createdAt: 10 }

  it('accepts a well-formed room', () => {
    expect(parseMeta(valid)).toEqual({ ...valid, guestUid: null, countdownAt: null })
    expect(parseMeta({ ...valid, guestUid: 'g', countdownAt: 20 })).toMatchObject({ guestUid: 'g', countdownAt: 20 })
  })

  it('treats anything malformed as no room at all', () => {
    expect(parseMeta(null)).toBeNull()
    expect(parseMeta('room')).toBeNull()
    expect(parseMeta({ ...valid, status: 'paused' })).toBeNull()
    expect(parseMeta({ ...valid, length: 'forever' })).toBeNull()
    expect(parseMeta({ ...valid, seed: '5' })).toBeNull()
    expect(parseMeta({ ...valid, hostUid: 42 })).toBeNull()
  })
})
