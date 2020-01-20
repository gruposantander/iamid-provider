'use strict'

const { it } = require('mocha')
const { deepEqual } = require('assert').strict

module.exports = function () {
  it('should create indexes on first request', async function () {
    if (this.mongo) {
      const { dbName } = this.mongo.instanceInfoSync
      const repository = await this.app.repositories.getRepository('session')
      const indexes = await repository._collection.indexes()
      const common = { v: 2, ns: `${dbName}.session` }
      const expected = [
        { key: { _id: 1 }, name: '_id_', ...common },
        { unique: true, key: { uid: 1 }, name: 'uid_1', ...common },
        { key: { expiresAt: 1 }, name: 'expiresAt_1', expireAfterSeconds: 0, ...common }
      ]
      deepEqual(indexes, expected)
    }
  })
}
