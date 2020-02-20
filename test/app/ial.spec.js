'use strict'

const assert = require('assert')
const { DEFAULT_REQUEST_OBJECT, getInteractionIdFromInteractionUri, jwtVerify } = require('./fixtures')
const { deepEqual } = assert.strict
const { ClaimResponse, Claim, Resolved } = require('../../lib/resolvers')
const { it } = require('mocha')

module.exports = function () {
  it('should filter every claim request and result depending ial level', async function () {
    const requestObject = {
      ...DEFAULT_REQUEST_OBJECT,
      ...{
        claims: {
          id_token: {
            birthdate: null, // Default ial 1
            email: { ial: 2 },
            assertion_claims: { birthdate: { assertion: { $gte: '1979-04-04' }, ial: 2 } }
          },
          userinfo: {
            birthdate: { ial: 2 },
            email: { ial: 3 },
            assertion_claims: { birthdate: { assertion: { $gte: '1979-04-03' }, ial: 3 } }
          }
        }
      }
    }
    const resolvedClaims = new ClaimResponse({
      birthdate: new Claim([
        new Resolved('1979-04-04', 1),
        new Resolved('1979-04-05', 2),
        new Resolved('1979-04-06', 3),
        new Resolved('1979-04-03', 3)
      ]),
      email: new Claim([
        new Resolved('victor.herraiz@santander.es', 1),
        new Resolved('victor.herraiz@santander.co.uk', 2)
      ])
    })
    const agent = this.agent()
    const interactionUrl = await this.goToSecondInteraction(agent, { requestObject })
    const { body: { claims } } = await this.secondInteraction(agent, interactionUrl, { resolvedClaims })
    const result1 = ['1979-04-04', '1979-04-05', '1979-04-06', '1979-04-03']
    const result2a = ['1979-04-05', '1979-04-06']
    const result2b = ['1979-04-05', '1979-04-06', '1979-04-03']
    const result3 = ['1979-04-06', '1979-04-03']
    const unresolved = []
    deepEqual(claims, {
      id_token: {
        birthdate: { ial: 1, unresolved, result: result1 },
        email: { ial: 2, unresolved, result: ['v****z@santander.co.uk'] },
        assertion_claims: {
          birthdate: { assertion: { $gte: '1979-04-04' }, ial: 2, match: true, result: result2a, unresolved }
        }
      },
      userinfo: {
        birthdate: { ial: 2, result: result2b, unresolved },
        email: { ial: 3, unresolved: [{ type: 'not_found' }], result: [] },
        assertion_claims: {
          birthdate: { assertion: { $gte: '1979-04-03' }, ial: 3, match: true, result: result3, unresolved }
        }
      }
    })
    const consentRequest = {
      approved_scopes: ['openid'],
      id_token: {
        claims: { birthdate: 1, email: 0 },
        assertions: { birthdate: 1 }
      },
      userinfo: {
        claims: { birthdate: 1, email: -1 },
        assertions: { birthdate: 1 }
      }
    }
    const interactionId = getInteractionIdFromInteractionUri(interactionUrl)
    const { header: { location } } = await this.consent(agent, interactionId, { consentRequest })
    const code = new URL(location).searchParams.get('code')
    const { body: { access_token: accessToken, id_token: encIdToken } } = await this.token(agent, code)
    {
      const { email, assertion_claims: assertionClaims, birthdate } = jwtVerify(encIdToken)
      deepEqual({ email, assertion_claims: assertionClaims, birthdate }, {
        birthdate: '1979-04-05',
        email: 'victor.herraiz@santander.co.uk',
        assertion_claims: { birthdate: { result: true } }
      })
    }
    {
      const { body: { birthdate, assertion_claims: assertionClaims } } = await this.userinfo(agent, accessToken)
      deepEqual({ birthdate, assertion_claims: assertionClaims }, {
        birthdate: '1979-04-06',
        assertion_claims: { birthdate: { result: true } }
      })
    }
  })
}
