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

function proxyClaimResolvers (resolvers) {
  const claimIndex = resolvers.reduce((map, resolver) => {
    resolver.claims.forEach((claim) => {
      const list = map.get(claim) || []
      list.push(resolver)
      map.set(claim, list)
    })
    return map
  }, new Map())

  async function resolve (auth, names) {
    const nameSet = names.reduce((set, name) => {
      const reducers = claimIndex.get(name) || []
      reducers.forEach((reducer) => set.add(reducer))
      return set
    }, new Set())

    const results = await Promise.all(Array.from(nameSet).map((resolver) => {
      const filteredNames = names.filter((name) => resolver.claims.includes(name))
      return resolver(auth, filteredNames).catch((error) => {
        debug('resolver error %j', error)
        const response = new ClaimResponse()
        filteredNames.forEach((name) => {
          response.set(name, new Claim([], [Unresolved.internalError()]))
        })
        return response
      })
    }))

    return results.reduce((response, result) => response.merge(result), new ClaimResponse())
  }

  resolve.claims = Array.from(claimIndex.keys())
  return resolve
}

class UnauthorizedError extends Error {}

module.exports = {
  proxyClaimResolvers,
  Resolved,
  Claim,
  ClaimResponse,
  Unresolved,
  UnauthorizedError
}
