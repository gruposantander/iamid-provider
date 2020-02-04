const { it } = require('mocha')
const {
  CLIENT, DEFAULT_REQUEST_OBJECT, AUTH,
  REQUEST_WITH_CLAIMS, getInteractionIdFromInteractionUri
} = require('./fixtures')
const assert = require('assert').strict

const { strictEqual, deepStrictEqual } = require('assert')

const { ClaimResponse, Claim, Unresolved, Resolved } = require('../../lib/resolvers')

module.exports = function () {
  it('should require consent in second interaction', async function () {
    const agent = this.agent()
    const requestObject = {
      ...DEFAULT_REQUEST_OBJECT,
      ...{
        nonce: 'banana',
        scope: 'openid',
        claims: {
          purpose: 'general purpose',
          id_token: {
            given_name: { essential: true, purpose: 'id_token given_name purpose' },
            total_balance: { essential: true, purpose: 'id_token total_balance purpose' }
          },
          userinfo: {
            family_name: { purpose: 'userinfo family_name purpose' },
            given_name: { essential: true, purpose: 'userinfo given_name purpose' },
            total_balance: { essential: true, purpose: 'userinfo total_balance purpose' },
            email: { essential: true, purpose: 'userinfo email purpose' },
            phone_number: { essential: true, purpose: 'userinfo phone_number purpose' },
            birthdate: { essential: true, purpose: 'userinfo birthdate purpose' },
            custard_apple: { essential: true, purpose: 'userinfo custard_apple purpose' }
          }
        }
      }
    }
    const interactionUrl = await this.goToSecondInteraction(agent, { requestObject })
    const interactionId = getInteractionIdFromInteractionUri(interactionUrl)
    const claims = {
      given_name: new Claim([new Resolved('Juan José', 2)]),
      family_name: new Claim([new Resolved('Ramírez Escribano', 2)]),
      total_balance: new Claim([new Resolved({ amount: '10.23', currency: 'GBP' }, 2)]),
      birthdate: new Claim([new Resolved('2000-01-10', 2)]),
      email: new Claim([new Resolved('custard.apple@santander.co.uk', 2)]),
      phone_number: new Claim([new Resolved('1234567890', 2), new Resolved('9456787767', 2)])
    }
    const resolvedClaims = new ClaimResponse(claims)
    const expected = {
      interaction: 'consent',
      interaction_id: interactionId,
      interaction_path: `/interaction/${interactionId}/consent`,
      redirect_uri: 'http://127.0.0.1:8080/cb',
      client: CLIENT,
      claims: {
        purpose: 'general purpose',
        id_token: {
          given_name: { essential: true, purpose: 'id_token given_name purpose', result: ['Ju****sé'], unresolved: [] },
          total_balance: { essential: true, purpose: 'id_token total_balance purpose', result: [{ amount: '10.23', currency: 'GBP' }], unresolved: [] }
        },
        userinfo: {
          family_name: { purpose: 'userinfo family_name purpose', result: ['Ra****no'], unresolved: [] },
          given_name: { essential: true, purpose: 'userinfo given_name purpose', result: ['Ju****sé'], unresolved: [] },
          total_balance: { essential: true, purpose: 'userinfo total_balance purpose', result: [{ amount: '10.23', currency: 'GBP' }], unresolved: [] },
          email: { essential: true, purpose: 'userinfo email purpose', result: ['c****e@santander.co.uk'], unresolved: [] },
          phone_number: { essential: true, purpose: 'userinfo phone_number purpose', result: ['******7890', '******7767'], unresolved: [] },
          birthdate: { essential: true, purpose: 'userinfo birthdate purpose', result: ['2000-01-10'], unresolved: [] }
        }
      },
      scopes: ['openid']
    }
    await this.secondInteraction(agent, interactionUrl, { resolvedClaims })
      .expect('Content-Type', 'application/json; charset=utf-8')
      .expect(expected)

    assert(this.claimStub.calledOnceWith(AUTH, {
      given_name: { ials: [1] },
      total_balance: { ials: [1] },
      family_name: { ials: [1] },
      email: { ials: [1] },
      phone_number: { ials: [1] },
      birthdate: { ials: [1] }
    }))
  })

  it('should return the "state" parameter', async function () {
    const agent = this.agent()
    const requestObject = { ...REQUEST_WITH_CLAIMS, state: 'state' }
    const interactionUrl = await this.goToSecondInteraction(agent, { requestObject })
    const interactionId = getInteractionIdFromInteractionUri(interactionUrl)
    const expected = {
      interaction: 'consent',
      interaction_id: interactionId,
      interaction_path: `/interaction/${interactionId}/consent`,
      redirect_uri: 'http://127.0.0.1:8080/cb',
      state: 'state',
      client: CLIENT,
      claims: {
        purpose: 'general purpose',
        id_token: {
          given_name: {
            essential: true, purpose: 'id_token given_name purpose', result: ['Ju****sé'], unresolved: []
          }
        },
        userinfo: {}
      },
      scopes: ['openid']
    }
    await this.secondInteraction(agent, interactionUrl)
      .expect(expected)
  })

  it('should understand claims with "null" value', async function () {
    const agent = this.agent()
    const requestObject = { ...DEFAULT_REQUEST_OBJECT, claims: { id_token: { given_name: null } } }

    const interactionUrl = await this.goToSecondInteraction(agent, { requestObject })
    const interactionId = getInteractionIdFromInteractionUri(interactionUrl)
    return this.secondInteraction(agent, interactionUrl)
      .expect({
        interaction: 'consent',
        interaction_id: interactionId,
        redirect_uri: 'http://127.0.0.1:8080/cb',
        interaction_path: `/interaction/${interactionId}/consent`,
        client: CLIENT,
        claims: {
          id_token: {
            given_name: { result: ['Ju****sé'], unresolved: [] }
          },
          userinfo: {}
        },
        scopes: ['openid']
      })
  })
  it('should filter out non supported assertion claims', async function () {
    const agent = this.agent()
    const assertionClaims = {
      given_name: { assertion: { $eq: 'John' } },
      banana: { assertion: { $eq: 'banana' } }
    }
    const requestObject = { ...DEFAULT_REQUEST_OBJECT, claims: { id_token: { assertion_claims: assertionClaims } } }

    const interactionUrl = await this.goToSecondInteraction(agent, { requestObject })
    const interactionId = getInteractionIdFromInteractionUri(interactionUrl)
    return this.secondInteraction(agent, interactionUrl).expect({
      interaction: 'consent',
      interaction_id: interactionId,
      redirect_uri: 'http://127.0.0.1:8080/cb',
      interaction_path: `/interaction/${interactionId}/consent`,
      client: CLIENT,
      claims: {
        id_token: {
          assertion_claims: {
            given_name: { assertion: { $eq: 'John' }, result: [], unresolved: [] }
          }
        },
        userinfo: {}
      },
      scopes: ['openid']
    })
  })

  it('should work when no claims are requested', async function () {
    const agent = this.agent()
    const interactionUrl = await this.goToSecondInteraction(agent, { requestObject: DEFAULT_REQUEST_OBJECT })
    const resolvedClaims = new ClaimResponse()
    const { body: { interaction, claims } } = await this.secondInteraction(agent, interactionUrl, { resolvedClaims })
    strictEqual(interaction, 'consent')
    deepStrictEqual(claims, { id_token: {}, userinfo: {} })
  })

  it('should filter out non supported claims', async function () {
    const agent = this.agent()
    const requestObject = Object.assign({}, DEFAULT_REQUEST_OBJECT, {
      claims: {
        purpose: 'general purpose',
        id_token: {
          given_name: { essential: true, purpose: 'id_token given_name purpose' },
          unknown_claim: { essential: true, purpose: 'id_token total_balance purpose' }
        },
        userinfo: {}
      }
    })

    const interactionUri = await this.goToSecondInteraction(agent, { requestObject })
    const interactionId = getInteractionIdFromInteractionUri(interactionUri)
    return this.secondInteraction(agent, interactionUri).expect({
      interaction: 'consent',
      interaction_id: interactionId,
      redirect_uri: 'http://127.0.0.1:8080/cb',
      interaction_path: `/interaction/${interactionId}/consent`,
      client: CLIENT,
      claims: {
        purpose: 'general purpose',
        id_token: {
          given_name: {
            essential: true,
            purpose: 'id_token given_name purpose',
            result: ['Ju****sé'],
            unresolved: []
          }
        },
        userinfo: {}
      },
      scopes: ['openid']
    })
  })

  it('should return a collection of claims that are not been resolved', async function () {
    const agent = this.agent()
    const requestObject = Object.assign({}, DEFAULT_REQUEST_OBJECT, {
      claims: {
        id_token: { given_name: { essential: true }, family_name: { essential: true } }
      }
    })
    const interactionUri = await this.goToSecondInteraction(agent, { requestObject })
    const resolvedClaims = new ClaimResponse({
      given_name: new Claim([new Resolved('Juan José', 2)]),
      family_name: new Claim([], [Unresolved.notFound()])
    })
    const interactionId = getInteractionIdFromInteractionUri(interactionUri)
    return this.secondInteraction(agent, interactionUri, { resolvedClaims }).expect({
      interaction: 'consent',
      interaction_id: interactionId,
      redirect_uri: 'http://127.0.0.1:8080/cb',
      interaction_path: `/interaction/${interactionId}/consent`,
      client: CLIENT,
      claims: {
        id_token: {
          given_name: { essential: true, result: ['Ju****sé'], unresolved: [] },
          family_name: { essential: true, result: [], unresolved: [{ type: 'not_found' }] }
        },
        userinfo: {}
      },
      scopes: ['openid']
    })
  })
}
