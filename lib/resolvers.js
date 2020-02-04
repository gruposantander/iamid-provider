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
    Object.freeze(this)
    Object.freeze(this.resolved)
    Object.freeze(this.unresolved)
  }

  /**
   * @param {number} ial
   */
  filterByIAL (ial) {
    const resolvedList = []
    const unresolvedList = this.unresolved.slice()
    this.resolved.forEach((resolved) => {
      if (resolved.ial >= ial) {
        resolvedList.push(resolved)
      } else {
        unresolvedList.push(Unresolved.notFound())
      }
    })
    return new Claim(resolvedList, unresolvedList)
  }

  /**
   * @param {Claim} claim
   * @returns {Claim} this
   */
  concat (claim) {
    return new Claim(
      this.resolved.concat(claim.resolved),
      this.unresolved.concat(claim.unresolved))
  }
}

const INTERNAL_ERROR_CLAIM = new Claim([], [Unresolved.internalError()])
const NOT_FOUND_CLAIM = new Claim([], [Unresolved.notFound()])

class ClaimResponse {
  constructor (claims = {}) {
    const entries = claims[Symbol.iterator] ? claims : Object.entries(claims)
    for (const [key, value] of entries) {
      this[key] = value
    }
    Object.freeze(this)
  }

  filterByName (claims) {
    const entries = Object.entries(this)
    const filtered = entries.filter(([name]) => claims[name])
    return new ClaimResponse(filtered)
  }

  /**
   * @param {ClaimResponse} response
   */
  concat (response) {
    const target = new Map(Object.entries(this))
    const source = Object.entries(response)
    for (const [key, value] of source) {
      const claim = target.get(key)
      target.set(key, claim ? claim.concat(value) : value)
    }
    return new ClaimResponse(target)
  }
}

const IAL_VALUES = Object.freeze([1, 2, 3]) // TODO duplicated enum, see consent

function proxyResolvers (...resolvers) {
  const resolverListMap = resolvers.reduce((map, resolver) => {
    Object.entries(resolver.claims).forEach(([name, { ial: max }]) => {
      assert(max && IAL_VALUES.includes(max), 'ial should be 1, 2 or 3')
      const list = map.get(name) || []
      list.push({ resolver, max })
      map.set(name, list)
    })
    return map
  }, new Map())

  async function resolve (auth, requestedClaims) {
    debug('resolve claims: %O', requestedClaims)
    const unresolvedList = new Map()
    const resolverSet = Object.entries(requestedClaims).reduce((set, [name, { ials }]) => {
      const resolvers = resolverListMap.get(name) || []
      const filtered = resolvers.filter((resolver) => resolver.max >= ials[0])
      if (filtered.length) {
        filtered.forEach((resolver) => set.add(resolver.resolver))
      } else {
        unresolvedList.set(name, NOT_FOUND_CLAIM)
      }
      return set
    }, new Set())
    const filteredResolvers = Array.from(resolverSet)
    const promises = filteredResolvers.map(async (resolver) => {
      const filteredEntries = Object.entries(requestedClaims)
        .filter(([name]) => resolver.claims[name])
      const filteredRequestedClaims = Object.fromEntries(filteredEntries)
      try {
        const response = await resolver(auth, filteredRequestedClaims)
        return response.filterByName(filteredRequestedClaims)
      } catch (error) {
        debug('resolver error %j', error)
        return new ClaimResponse(filteredEntries.map(([name]) => [name, INTERNAL_ERROR_CLAIM]))
      }
    })
    const results = await Promise.all(promises)
    const response = new ClaimResponse(unresolvedList)

    return results.reduce((response, result) => response.concat(result), response)
  }

  resolve.claims = Array.from(resolverListMap).reduce((obj, [name, value]) => {
    const max = value.reduce((p, n) => p.max > n.max ? p : n).max
    obj[name] = { ial: max }
    return obj
  }, {})
  return resolve
}

class UnauthorizedError extends Error {}

module.exports = {
  proxyResolvers,
  Resolved,
  Claim,
  ClaimResponse,
  Unresolved,
  UnauthorizedError
}
