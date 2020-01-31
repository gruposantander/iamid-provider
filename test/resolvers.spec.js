'use strict'

const { it } = require('mocha')
const { proxyClaimResolvers, ClaimResponse, Claim, Resolved, Unresolved } = require('../lib/resolvers')
const { deepEqual, equal, fail } = require('assert').strict

module.exports = function () {
  const AUTH = 'auth'

  function resolvedValues (values) {
    return values.map(value => new Resolved(value, 2))
  }

  it('should be able to return the same claims from multiple resolvers', async function () {
    async function resolverA (auth, requestedClaims) {
      equal(auth, AUTH)
      deepEqual(requestedClaims, [{ name: 'key1', ial: 2 }, { name: 'key2', ial: 2 }])
      return new ClaimResponse({
        key1: new Claim(resolvedValues(['A1.1', 'A1.2'])),
        key2: new Claim(resolvedValues(['A2.1']))
      })
    }
    resolverA.claims = [{ name: 'key1', ial: 2 }, { name: 'key2', ial: 2 }]
    async function resolverB (auth, requestedClaims) {
      equal(auth, AUTH)
      deepEqual(requestedClaims, [{ name: 'key1', ial: 2 }, { name: 'key3', ial: 2 }])
      return new ClaimResponse({
        key1: new Claim(resolvedValues(['B1.1', 'B1.2', 'B1.3'])),
        key3: new Claim(resolvedValues(['B3.1', 'B3.2']))
      })
    }
    resolverB.claims = [{ name: 'key1', ial: 2 }, { name: 'key3', ial: 2 }]
    async function resolverC (auth, requestedClaims) {
      equal(auth, AUTH)
      deepEqual(requestedClaims, [{ name: 'key2', ial: 2 }])
      return new ClaimResponse({
        key2: new Claim(resolvedValues(['C2.1']))
      })
    }
    resolverC.claims = [{ name: 'key2', ial: 2 }]

    const proxy = proxyClaimResolvers([resolverA, resolverB, resolverC])
    deepEqual(proxy.claims, [
      { name: 'key1', ial: 2 },
      { name: 'key2', ial: 2 },
      { name: 'key3', ial: 2 }
    ])
    const actual = await proxy(AUTH, [
      { name: 'key1', ial: 2 },
      { name: 'key2', ial: 2 },
      { name: 'key3', ial: 2 }
    ])
    const expected = new ClaimResponse({
      key1: new Claim(resolvedValues(['A1.1', 'A1.2', 'B1.1', 'B1.2', 'B1.3'])),
      key2: new Claim(resolvedValues(['A2.1', 'C2.1'])),
      key3: new Claim(resolvedValues(['B3.1', 'B3.2']))
    })
    deepEqual(actual, expected)
  })
  it('should return unresolved if a request claim is filtered out (missing)', async function () {
    async function resolverA (auth, requestedClaims) {
      return new ClaimResponse({
        key1: new Claim(resolvedValues(['A1.1', 'A1.2'])),
        key2: new Claim(resolvedValues(['A2.1']))
      })
    }
    resolverA.claims = [{ name: 'key1', ial: 2 }, { name: 'key2', ial: 2 }]
    const proxy = proxyClaimResolvers([resolverA])
    const actual = await proxy(AUTH, [
      { name: 'key1', ial: 2 },
      { name: 'key3', ial: 2 }
    ])
    const expected = new ClaimResponse({
      key1: new Claim(resolvedValues(['A1.1', 'A1.2'])),
      key3: new Claim([], [Unresolved.notFound()])
    })
    deepEqual(actual, expected)
  })
  it('should return unresolved if a request claim is filtered out (low ial on config)', async function () {
    async function resolverA (auth, requestedClaims) {
      fail('no call')
    }
    resolverA.claims = [{ name: 'key1', ial: 2 }]
    const proxy = proxyClaimResolvers([resolverA])
    const actual = await proxy(AUTH, [{ name: 'key1', ial: 3 }])
    const expected = new ClaimResponse({ key1: new Claim([], [Unresolved.notFound()]) })
    deepEqual(actual, expected)
  })
  it('should return unresolved if a request claim is filtered out (low ial on response)', async function () {
    async function resolverA (auth, requestedClaims) {
      return new ClaimResponse({
        key1: new Claim(resolvedValues(['A1.1', 'A1.2'])),
        key2: new Claim(resolvedValues(['A2.1']))
      })
    }
    resolverA.claims = [{ name: 'key1', ial: 3 }, { name: 'key2', ial: 2 }]
    const proxy = proxyClaimResolvers([resolverA])
    const actual = await proxy(AUTH, [{ name: 'key1', ial: 3 }, { name: 'key2', ial: 2 }])
    const expected = new ClaimResponse({
      key1: new Claim([], [Unresolved.notFound(), Unresolved.notFound()]),
      key2: new Claim(resolvedValues(['A2.1']))
    })
    deepEqual(actual, expected)
  })
}
