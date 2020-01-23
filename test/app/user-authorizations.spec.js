'use strict'

const { describe, it, before, afterEach } = require('mocha')
const { Authorization, SystemAuth, UserAuthorizations } = require('../../lib/user-authorizations.js')
const { ok, equal, deepStrictEqual } = require('assert').strict

module.exports = function () {
  const AUTH_DATA = { token: '276276276276276267262' }
  const SYSTEM_ID = 'minibank'
  const USER_ID = '6YU8IG56'
  describe('Authorization Class', function () {
    it('id should be generated automatically', function () {
      const auth = new Authorization()
      ok(auth.id.length !== 0)
    })
    it('upsert should insert when empty systems array', function () {
      const auth = new Authorization()
      const system = new SystemAuth(SYSTEM_ID, USER_ID, AUTH_DATA)
      auth.upsertSystemAuth(system)
      equal(auth.systems.length, 1)
      deepStrictEqual(auth.systems[0], system)
    })
    it('upsert should insert when filled systems array', function () {
      const system0 = new SystemAuth('sanuk', '56789', AUTH_DATA)
      const auth = new Authorization('exampleid', [system0])
      const system = new SystemAuth(SYSTEM_ID, USER_ID, AUTH_DATA)
      auth.upsertSystemAuth(system)
      equal(auth.systems.length, 2)
      deepStrictEqual(auth.systems[1], system)
    })
    it('upsert should update existing system items', function () {
      const system = new SystemAuth(SYSTEM_ID, USER_ID, AUTH_DATA)
      const auth = new Authorization('exampleid', [system])
      const system2 = new SystemAuth(SYSTEM_ID, USER_ID, { token: 'newToken' })
      auth.upsertSystemAuth(system2)
      equal(auth.systems.length, 1)
      deepStrictEqual(auth.systems[0], system2)
    })
    it('getSystem should retrieve the correct object', function () {
      const system0 = new SystemAuth('sanuk', '56789', AUTH_DATA)
      const auth = new Authorization('exampleid', [system0])
      const system = new SystemAuth(SYSTEM_ID, USER_ID, AUTH_DATA)
      auth.upsertSystemAuth(system)
      const obtained = auth.getSystem('sanuk')
      const obtained2 = auth.getSystem(SYSTEM_ID)
      deepStrictEqual(obtained, system0)
      deepStrictEqual(obtained2, system)
    })
    it('getSystem should not fail when system not exist', function () {
      const auth = new Authorization()
      const system = auth.getSystem(SYSTEM_ID)
      equal(system, null)
    })
  })
  describe('UserAuthorizations', function () {
    before('Setup Adapter', function () {
      this.authAdapter = new UserAuthorizations(this.app.repositories)
    })
    it('should save and retrieve from adapter correctly', async function () {
      const id = await this.authAdapter.save(SYSTEM_ID, USER_ID, AUTH_DATA)
      const authData = await this.authAdapter.get(id, SYSTEM_ID)
      deepStrictEqual(authData, AUTH_DATA)
    })
    it('should not create a new user if already exist', async function () {
      const id = await this.authAdapter.save(SYSTEM_ID, USER_ID, AUTH_DATA)
      const id2 = await this.authAdapter.save(SYSTEM_ID, USER_ID, AUTH_DATA)
      equal(id, id2)
    })
    it('should overwrite auth if already exist the user', async function () {
      const id = await this.authAdapter.save(SYSTEM_ID, USER_ID, AUTH_DATA)
      await this.authAdapter.save(SYSTEM_ID, USER_ID, { token: 'newToken' })
      const authData = await this.authAdapter.get(id, SYSTEM_ID)
      deepStrictEqual(authData, { token: 'newToken' })
    })
    afterEach('clean consent repository', async function () {
      (await this.app.repositories.getRepository(UserAuthorizations.getRepoName())).clear()
    })
  })
}
