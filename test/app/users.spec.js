'use strict'

const { describe, it, before, afterEach } = require('mocha')
const { Users, User, Connection } = require('../..')
const { ok, equal, deepEqual } = require('assert').strict

module.exports = function () {
  const AUTH_DATA = { token: '276276276276276267262' }
  const SYSTEM_ID = 'minibank'
  const USER_ID = '6YU8IG56'
  const ID = 'ID'
  describe('User', function () {
    it('should generated the id automatically', function () {
      const user = new User()
      ok(user.id.length !== 0)
    })
    it('should have a set connection with no duplicates', function () {
      const connection1 = new Connection('sanuk', '56789', AUTH_DATA)
      const user = new User(ID)
      const connection2 = new Connection(SYSTEM_ID, USER_ID, AUTH_DATA)
      const connection3 = new Connection('sanuk', '56789', { })
      user.setConnection(connection1)
      user.setConnection(connection2)
      user.setConnection(connection3)
      deepEqual(user, new User(ID, [connection3, connection2]))
    })
    it('should retrieve connections by type', function () {
      const user = new User(ID)
      deepEqual(user.getConnection(SYSTEM_ID), null)
      const connection = new Connection(SYSTEM_ID, USER_ID, AUTH_DATA)
      user.setConnection(connection)
      deepEqual(user.getConnection(SYSTEM_ID), connection)
    })
  })
  describe('Users (repository)', function () {
    before('Setup Adapter', function () {
      this.users = new Users(this.repositories)
    })
    it('should save and retrieve from adapter correctly', async function () {
      const connection = new Connection(SYSTEM_ID, USER_ID, AUTH_DATA)
      const id = await this.users.insertOrUpdate(connection)
      const user = await this.users.get(id)
      const result = user.getConnection(SYSTEM_ID)
      deepEqual(result.auth, AUTH_DATA)
    })
    it('should not create a new user if already exist', async function () {
      const id = await this.users.insertOrUpdate(new Connection(SYSTEM_ID, USER_ID, AUTH_DATA))
      const id2 = await this.users.insertOrUpdate(new Connection(SYSTEM_ID, USER_ID, AUTH_DATA))
      equal(id, id2)
    })
    it('should overwrite auth if already exist the user', async function () {
      const id1 = await this.users.insertOrUpdate(new Connection(SYSTEM_ID, USER_ID, AUTH_DATA))
      await this.users.insertOrUpdate(new Connection(SYSTEM_ID, USER_ID, { token: 'newToken' }))
      const user = await this.users.get(id1)
      deepEqual(user.getConnection(SYSTEM_ID).auth, { token: 'newToken' })
    })
    it('should contain only one system and not duplicate', async function () {
      const id = await this.users.insertOrUpdate(new Connection(SYSTEM_ID, USER_ID, AUTH_DATA))
      await this.users.insertOrUpdate(new Connection(SYSTEM_ID, USER_ID, { token: 'newToken' }))
      const user = await this.users.get(id)
      equal(user.connections.length, 1)
    })
    afterEach('clean consent repository', async function () {
      (await this.repositories.getRepository(Users.getRepoName())).clear()
    })
  })
}
