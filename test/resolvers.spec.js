'use strict'

const { it } = require('mocha')
const { proxyResolvers, ClaimResponse, Claim, Resolved, Unresolved } = require('../lib/resolvers')
const { deepEqual, equal, fail } = require('assert').strict

module.exports = function () {
  const AUTH = 'auth'

  function r2 (value) {
    return new Resolved(value, 2)
  }

  it('should provide a proxy that exposes a proper reduction of claims supported', function () {
    const resolverA = { claims: { key1: { ial: 1 }, key2: { ial: 1 } } }
    const resolverB = { claims: { key1: { ial: 2 }, key2: { ial: 1 }, key3: { ial: 1 } } }
    const resolverC = { claims: { key2: { ial: 3 } } }
    const proxy = proxyResolvers(resolverA, resolverB, resolverC)
    deepEqual(proxy.claims, { key1: { ial: 2 }, key2: { ial: 3 }, key3: { ial: 1 } })
  })

  it('should be able to return the same claims from multiple resolvers', async function () {
    async function resolverA (auth, requestedClaims) {
      equal(auth, AUTH)
      deepEqual(requestedClaims, { key1: { ials: [2] }, key2: { ials: [2] } })
      return new ClaimResponse({
        key1: new Claim([r2('A1.1'), r2('A1.2')]),
        key2: new Claim([r2('A2.1')])
      })
    }
    resolverA.claims = { key1: { ial: 2 }, key2: { ial: 2 } }
    async function resolverB (auth, requestedClaims) {
      equal(auth, AUTH)
      deepEqual(requestedClaims, { key1: { ials: [2] }, key3: { ials: [2] } })
      return new ClaimResponse({
        key1: new Claim([r2('B1.1'), r2('B1.2'), r2('B1.3')]),
        key3: new Claim([r2('B3.1'), r2('B3.2')])
      })
    }
    resolverB.claims = { key1: { ial: 2 }, key3: { ial: 2 } }
    async function resolverC (auth, requestedClaims) {
      equal(auth, AUTH)
      deepEqual(requestedClaims, { key2: { ials: [2] } })
      return new ClaimResponse({
        key2: new Claim([r2('C2.1')])
      })
    }
    resolverC.claims = { key2: { ial: 2 } }

    const proxy = proxyResolvers(resolverA, resolverB, resolverC)

    const actual = await proxy(AUTH, { key1: { ials: [2] }, key2: { ials: [2] }, key3: { ials: [2] } })
    const expected = new ClaimResponse({
      key1: new Claim([r2('A1.1'), r2('A1.2'), r2('B1.1'), r2('B1.2'), r2('B1.3')]),
      key2: new Claim([r2('A2.1'), r2('C2.1')]),
      key3: new Claim([r2('B3.1'), r2('B3.2')])
    })
    deepEqual(actual, expected)
  })

  it('should return unresolved if a request claim is filtered out (missing)', async function () {
    async function resolverA (auth, requestedClaims) {
      return new ClaimResponse({
        key1: new Claim([r2('A1.1'), r2('A1.2')]),
        key2: new Claim([r2('A2.1')])
      })
    }
    resolverA.claims = { key1: { ial: 2 }, key2: { ial: 2 } }
    const proxy = proxyResolvers(resolverA)
    const actual = await proxy(AUTH, { key1: { ials: [2] }, key3: { ial: [2] } })
    const expected = new ClaimResponse({
      key1: new Claim([r2('A1.1'), r2('A1.2')]),
      key3: new Claim([], [Unresolved.notFound()])
    })
    deepEqual(actual, expected)
  })

  it('should return unresolved if a request claim is filtered out (low ial on config)', async function () {
    async function resolverA () {
      fail('no call')
    }
    resolverA.claims = { key1: { ial: 2 } }
    const proxy = proxyResolvers(resolverA)
    const actual = await proxy(AUTH, { key1: { ials: [3] } })
    const expected = new ClaimResponse({ key1: new Claim([], [Unresolved.notFound()]) })
    deepEqual(actual, expected)
  })
}
