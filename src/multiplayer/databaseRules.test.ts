import rulesFile from '../../database.rules.json'
import { buildDatabaseRules } from './databaseRules'

describe('database.rules.json', () => {
  it('is up to date with src/multiplayer/databaseRules.ts (run npm run rules:build)', () => {
    expect(rulesFile).toEqual(buildDatabaseRules())
  })
})
