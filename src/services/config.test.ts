import { resolveFirebaseStatus } from './config'

const FULL = {
  VITE_FIREBASE_API_KEY: 'key',
  VITE_FIREBASE_AUTH_DOMAIN: 'cup-catcher.firebaseapp.com',
  VITE_FIREBASE_DATABASE_URL: 'https://cup-catcher-default-rtdb.firebaseio.com',
  VITE_FIREBASE_PROJECT_ID: 'cup-catcher',
  VITE_FIREBASE_APP_ID: '1:123:web:abc',
}

describe('Firebase configuration', () => {
  it('reports online features as awaiting configuration when nothing is set', () => {
    const status = resolveFirebaseStatus({})
    expect(status.configured).toBe(false)
    expect(status.config).toBeNull()
    expect(status.missing).toEqual(Object.keys(FULL))
  })

  it('names exactly what is missing, and treats blank values as missing', () => {
    const status = resolveFirebaseStatus({ ...FULL, VITE_FIREBASE_DATABASE_URL: '   ', VITE_FIREBASE_APP_ID: undefined })
    expect(status.configured).toBe(false)
    expect(status.missing).toEqual(['VITE_FIREBASE_DATABASE_URL', 'VITE_FIREBASE_APP_ID'])
  })

  it('builds the web config when every value is present', () => {
    const status = resolveFirebaseStatus({ ...FULL, VITE_FIREBASE_STORAGE_BUCKET: 'bucket' })
    expect(status).toMatchObject({ configured: true, useEmulators: false, missing: [] })
    expect(status.config).toEqual({
      apiKey: 'key',
      authDomain: 'cup-catcher.firebaseapp.com',
      databaseURL: 'https://cup-catcher-default-rtdb.firebaseio.com',
      projectId: 'cup-catcher',
      appId: '1:123:web:abc',
      storageBucket: 'bucket',
    })
  })

  it('points at the local emulators without any real credentials', () => {
    const status = resolveFirebaseStatus({ VITE_USE_FIREBASE_EMULATORS: 'true' })
    expect(status).toMatchObject({ configured: true, useEmulators: true, emulatorHost: '127.0.0.1' })
    expect(status.config?.projectId).toBe('demo-cup-catcher')
    expect(status.config?.databaseURL).toBe('http://127.0.0.1:9000/?ns=demo-cup-catcher-default-rtdb')
  })
})
