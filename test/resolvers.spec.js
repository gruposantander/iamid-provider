'use strict'

const { it } = require('mocha')
const { proxyClaimResolvers, ClaimResponse, Claim } = require('../lib/resolvers')
const { deepEqual, equal } = require('assert').strict

module.exports = function () {
  it('should be able to return the same claims from multiple resolvers', async function () {
    const AUTH = 'auth'
    async function resolverA (auth, names) {
      equal(auth, AUTH)
      deepEqual(names, ['key1', 'key2'])
      return new ClaimResponse({
        key1: new Claim(['A1.1', 'A1.2']),
        key2: new Claim(['A2.1'])
      })
    }
    resolverA.claims = ['key1', 'key2']
    async function resolverB (auth, names) {
      equal(auth, AUTH)
      deepEqual(names, ['key1', 'key3'])
      return new ClaimResponse({
        key1: new Claim(['B1.1', 'B1.2', 'B1.3']),
        key3: new Claim(['B3.1', 'B3.2'])
      })
    }
    resolverB.claims = ['key1', 'key3']
    async function resolverC (auth, names) {
      equal(auth, AUTH)
      deepEqual(names, ['key2'])
      return new ClaimResponse({
        key2: new Claim(['C2.1'])
      })
    }
    resolverC.claims = ['key2']

    const proxy = proxyClaimResolvers([resolverA, resolverB, resolverC])
    deepEqual(proxy.claims, ['key1', 'key2', 'key3'])
    const actual = await proxy(AUTH, ['key1', 'key2', 'key3'])
    const expected = new ClaimResponse({
      key1: new Claim(['A1.1', 'A1.2', 'B1.1', 'B1.2', 'B1.3']),
      key2: new Claim(['A2.1', 'C2.1']),
      key3: new Claim(['B3.1', 'B3.2'])
    })
    deepEqual(actual, expected)
  })
}
