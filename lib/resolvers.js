'use strict'

const debug = require('debug')('claim-resolver')
const { assert } = require('./assertions')

class Unresolved {
  constructor (type) {
    this.type = type
  }

  static notFound () {
    return new Unresolved('not_found')
  }

  static internalError () {
    return new Unresolved('internal_error')
  }
}

class Resolved {
  constructor (value, ial) {
    this.value = value
    this.ial = ial
  }
}

function checkResolved (resolved) {
  assert(resolved instanceof Resolved, 'resolved should be an instance of Resolved')
}

class Claim {
  constructor (resolved = [], unresolved = []) {
    resolved.forEach(checkResolved)
    this.resolved = resolved
    this.unresolved = unresolved
  }

  /**
   * @param {Resolved} resolved
   */
  addResolved (resolved) {
    checkResolved(resolved)
    this.resolved.push(resolved)
  }

  /**
   * @param {*} value
   */
  addUnresolved (value) {
    this.unresolved.push(value)
  }

  processIAL (ial) {
    const claim = new Claim([], this.unresolved)
    this.resolved.forEach((resolved) => {
      if (resolved.ial >= ial) {
        claim.addResolved(resolved)
      } else {
        claim.addUnresolved(Unresolved.notFound())
      }
    })
    return claim
  }

  /**
   * @param {Claim} claim
   * @returns {Claim} this
   */
  merge (claim) {
    this.resolved = this.resolved.concat(claim.resolved)
    this.unresolved = this.unresolved.concat(claim.unresolved)
    return this
  }
}

class ClaimResponse {
  constructor (claims = {}) {
    this.claims = claims
  }

  /**
   * @param {string} name
   * @param {Claim} values
   */
  set (name, claim) {
    this.claims[name] = claim
  }

  /**
   * @param {Claim} name
   */
  get (name) {
    return this.claims[name]
  }

  filter (claims) {
    const entries = Object.entries(this.claims)
    const filtered = entries.filter(([name]) => claims.some((claim) => claim.name === name))
    const ialProcessed = filtered.map(([name, claim]) => [name, claim.processIAL(claims.find((claim) => claim.name === name).ial)])
    this.claims = Object.fromEntries(ialProcessed)
    return this
  }

  /**
   * @param {ClaimResponse} claimResponse
   */
  merge (claimResponse) {
    Object.entries(claimResponse.claims).forEach(([name, value]) => {
      const claim = this.get(name) || new Claim()
      this.set(name, claim.merge(value))
    })
    return this
  }
}

const IAL_VALUES = Object.freeze([1, 2, 3]) // TODO duplicated enum, see consent

function proxyResolvers (resolvers) {
  const resolverListMap = resolvers.reduce((map, resolver) => {
    resolver.claims.forEach(({ name, ial }) => {
      assert(typeof name === 'string', 'name should be an string')
      assert(ial && IAL_VALUES.includes(ial), 'ial should be 1, 2 or 3')
      const list = map.get(name) || []
      list.push({ resolver, ial })
      map.set(name, list)
    })
    return map
  }, new Map())

  async function resolve (auth, requestedClaims) {
    const response = new ClaimResponse()
    const resolverSet = requestedClaims.reduce((set, { name, ial = 1 }) => {
      const resolvers = resolverListMap.get(name) || []
      const filtered = resolvers.filter((resolver) => resolver.ial >= ial)
      if (filtered.length) {
        filtered.forEach((resolver) => set.add(resolver.resolver))
      } else {
        response.set(name, new Claim([], [Unresolved.notFound()]))
      }
      return set
    }, new Set())

    const promises = Array.from(resolverSet).map(async (resolver) => {
      const filteredRequestedClaims = requestedClaims
        .filter(({ name }) => resolver.claims.some((claim) => claim.name === name))
      try {
        const response = await resolver(auth, filteredRequestedClaims)
        return response.filter(filteredRequestedClaims)
      } catch (error) {
        debug('resolver error %j', error)
        const response = new ClaimResponse()
        filteredRequestedClaims.forEach(({ name }) => {
          response.set(name, new Claim([], [Unresolved.internalError()]))
        })
        return response
      }
    })
    const results = await Promise.all(promises)
    return results.reduce((response, result) => response.merge(result), response)
  }

  resolve.claims = Array.from(resolverListMap).reduce((arr, [name, value]) => {
    const ial = value.reduce((p, n) => p.ial > n.ial ? p : n).ial
    arr.push({ name, ial })
    return arr
  }, [])
  return resolve
}

class UnauthorizedError extends Error {}

module.exports = {
  proxyClaimResolvers: proxyResolvers,
  Resolved,
  Claim,
  ClaimResponse,
  Unresolved,
  UnauthorizedError
}
