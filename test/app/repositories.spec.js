'use strict'

const { it } = require('mocha')
const { deepEqual } = require('assert').strict
const { Users } = require('../..')
const indexConfig = require('../../lib/configuration/default-repositories')

module.exports = function () {
  const collections = ['AccessToken', 'AuthorizationCode', 'Interaction', 'PushedAuthorizationRequest', 'ReplayDetection',
    'Session', 'consents', Users.getRepoName()]
  collections.forEach((name) => {
    it('should create indexes correctly ' + name, async function () {
      if (this.mongo) {
        const { dbName } = this.mongo.instanceInfoSync
        const { 'default-mongodb-indexes': def, [name + '-mongodb-indexes']: cfgIndex = def } = indexConfig
        const repository = await this.app.repositories.getRepository(name)
        const indexes = await repository._collection.indexes()
        const common = { v: 2, ns: `${dbName}.${name}` }
        const withCommon = cfgIndex.map((obj) => { return { ...obj, ...common } })
        const expected = [
          { key: { _id: 1 }, name: '_id_', ...common }, ...withCommon
        ]
        deepEqual(indexes, expected)
      }
    })
  })
}
