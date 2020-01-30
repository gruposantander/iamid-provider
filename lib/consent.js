'use strict'

const { assert, assertObject, assertStringArray, throwAssertionError } = require('./assertions')

class AcceptedGroup {
  constructor (claims, assertions) {
    this.claims = claims
    this.assertions = assertions
  }

  static fromJSON (name, group, validate = false) {
    const { claims, assertions, approved_claims: approvedClaims = [], approved_assertions: approvedAssertions = [] } = group
    if (validate) {
      assertStringArray(approvedClaims, 'approved_claims must be an array of strings')
      assertStringArray(approvedAssertions, 'approved_assertions must be an array of strings')
      if (claims !== null && claims !== undefined) {
        assert(claims.constructor === Object, 'claims must be an object')
        Object.entries(claims).forEach(([key, value]) => {
          assert(Number.isInteger(value) && value >= -1, `index ${value} is not valid for ${key} claim at ${name}`)
        })
      }
      if (assertions !== null && assertions !== undefined) {
        assert(assertions.constructor === Object, 'assertions must be an object')
        Object.entries(assertions).forEach(([key, value]) => {
          assert(Number.isInteger(value) && value >= -1, `index ${value} is not valid for ${key} assertion claim at ${name}`)
        })
      }
    }
    return new AcceptedGroup(
      claims || Object.fromEntries(approvedClaims.map(name => [name, 0])),
      assertions || Object.fromEntries(approvedAssertions.map(name => [name, 0])))
  }
}

class Accepted {
  /**
   * @param {AcceptedGroup} idToken
   * @param {AcceptedGroup} userInfo
   * @param {String[]} scopes
   */
  constructor (idToken, userInfo, scopes) {
    this.id_token = idToken
    this.userinfo = userInfo
    this.approved_scopes = scopes
  }

  static fromJSON (obj, validate = false) {
    const idToken = obj.id_token || {}
    const userInfo = obj.userinfo || {}
    const scopes = obj.approved_scopes
    if (validate) {
      assertObject(idToken, 'id_token must be an object')
      assertObject(userInfo, 'userinfo must be an object')
      assertStringArray(scopes, 'approved_scopes must be an array of strings')
    }
    return new Accepted(
      AcceptedGroup.fromJSON('id_token', idToken, validate),
      AcceptedGroup.fromJSON('userinfo', userInfo, validate),
      scopes
    )
  }
}

/**
 * @param {('token_id'|'userinfo')} group
 * @param {any} groups
 * @param {Accepted} approved
 */
function validateAccepted (group, groups, approved) {
  const resolved = groups[group]
  const { assertion_claims: assertionClaims } = resolved
  const { claims, assertions } = approved[group]
  Object.entries(claims).forEach(([name, index]) => {
    const claim = resolved[name]
    if (!resolved[name]) {
      throwAssertionError(`${name} could not be accepted as it has not been requested at ${group}`)
    }
    if (index >= claim.result.length) {
      throwAssertionError(`index ${index} is not valid for ${name} claim at ${group}`)
    }
  })
  Object.entries(assertions).forEach(([name, index]) => {
    if (!assertionClaims[name]) {
      throwAssertionError(`${name} could not be accepted as it has not been requested at ${group} assertions`)
    }
  })
}

/* eslint-disable camelcase */
const IAL_VALUES = Object.freeze([1, 2, 3])

class AssertionClaim {
  constructor (options) {
    this.purpose = options.purpose
    this.assertion = options.assertion
    // TODO this should be in another domain object to avoid duplication
    this.result = options.result
    this.raw_result = options.raw_result
    this.unresolved = options.unresolved
  }

  static fromJSON (obj, validate = false) {
    if (validate) {
      assertObject(obj, 'assertion claim must by an object')
      const { purpose, assertion } = obj
      assert(purpose === undefined || typeof purpose === 'string', 'purpose must by a string')
      assertObject(assertion, 'assertion should be an object')
    }
    return new AssertionClaim(obj)
  }
}

class AssertionGroupClaim {
  constructor (entries) {
    entries.forEach(([key, value]) => { this[key] = value })
  }

  static fromJSON (obj = {}, validate = false) {
    if (validate) {
      assertObject(obj, 'group should be an object')
    }
    const entries = Object.entries(obj).map(([key, value]) => [key, AssertionClaim.fromJSON(value, validate)])
    return new AssertionGroupClaim(entries)
  }
}

class Claim {
  constructor (options = {}) {
    this.purpose = options.purpose
    this.essential = options.essential
    this.ial = options.ial
    this.value = options.value
    this.values = options.values
    // TODO this should be in another domain object to avoid duplication
    this.result = options.result
    this.raw_result = options.raw_result
    this.unresolved = options.unresolved
  }

  static fromJSON (obj, validate = false) {
    // options could be null
    if (obj && validate) {
      const { purpose, essential, ial, values } = obj
      assert(purpose === undefined || typeof purpose === 'string', 'purpose should be an string')
      assert(essential === undefined || typeof essential === 'boolean', 'essential should be a boolean')
      assert(ial === undefined || IAL_VALUES.includes(ial), 'ial should be 1, 2 or 3')
      assert(values === undefined || Array.isArray(values), 'values should be an array')
    }
    return new Claim(obj || undefined)
  }
}

class ClaimGroup {
  constructor (purpose, assertion_claims, entries = []) {
    this.purpose = purpose
    this.assertion_claims = assertion_claims
    entries.forEach(([key, value]) => { this[key] = value })
  }

  static fromJSON (obj = {}, validate = false) {
    if (validate) {
      assertObject(obj, 'group should be an object')
    }
    const { purpose, assertion_claims, ...claims } = obj
    const entries = Object.entries(claims).map(([key, value]) => [key, Claim.fromJSON(value, validate)])
    return new ClaimGroup(purpose, AssertionGroupClaim.fromJSON(assertion_claims, validate), entries)
  }
}

class Claims {
  constructor (purpose, id_token, userinfo) {
    this.purpose = purpose
    this.id_token = id_token
    this.userinfo = userinfo
  }

  static fromJSON (obj, validate = false) {
    const { purpose, id_token, userinfo } = obj
    // TODO validate
    return new Claims(purpose, ClaimGroup.fromJSON(id_token, validate), ClaimGroup.fromJSON(userinfo, validate))
  }
}
/* eslint-enable camelcase */

class Consent {
  /**
   * @param {String} clientId
   * @param {String} userId
   * @param {Claims} claims
   * @param {array} scopes
   * @returns {Consent}
   */
  static createConsent (clientId, userId, claims, scopes) {
    return new Consent(clientId, userId, claims, scopes)
  }

  static fromJSON (obj) {
    if (!obj) return null
    const { clientId, userId, claims, scopes, accepted } = obj
    return new Consent(clientId, userId, Claims.fromJSON(claims), scopes, accepted && Accepted.fromJSON(accepted))
  }

  constructor (clientId, userId, claims, scopes, accepted = null) {
    this.clientId = clientId
    this.userId = userId
    this.claims = claims
    this.scopes = scopes
    this.accepted = accepted
  }

  get id () {
    return this.userId + '$$' + this.clientId
  }

  /**
   * @param {Accepted} accepted
   * @returns {Consent}
   */
  resolve (accepted) {
    const { claims, scopes } = this
    validateAccepted('id_token', claims, accepted)
    validateAccepted('userinfo', claims, accepted)
    return new Consent(this.clientId, this.userId, claims, scopes, accepted)
  }

  claimsFor (section) {
    const { claims, assertions } = this.accepted[section]
    const group = this.claims[section]
    const result = Object.entries(claims).reduce((obj, [name, index]) => {
      if (index !== -1) {
        obj[name] = group[name].raw_result.value[index].value
      }
      return obj
    }, { sub: this.userId })

    const assertionEntries = Object.entries(assertions)
    if (assertionEntries.length) {
      const assertionGroup = group.assertion_claims
      result.assertion_claims = assertionEntries.reduce((obj, [name, index]) => {
        const { raw_result: raw, unresolved } = assertionGroup[name]
        if (unresolved.some(({ type }) => type === 'unknown_operator')) {
          obj[name] = { result: null, error: 'unknown_operator' }
        } else if (index !== -1) {
          obj[name] = { result: !!raw.value.length }
        }
        return obj
      }, {})
    }
    return result
  }
}

module.exports = {
  Consent, Accepted, AcceptedGroup, Claims, ClaimGroup
}
