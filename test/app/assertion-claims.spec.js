'use strict'

const { it } = require('mocha')
const {
  getInteractionIdFromInteractionUri, jwtVerify,
  CONSENT_PATH, INTERACTION_PATH, error,
  DEFAULT_REQUEST_OBJECT, CLIENT, AUTH
} = require('./fixtures')
const { ClaimResponse, Claim, Resolved } = require('../../lib/resolvers')
const assert = require('assert')
const { deepStrictEqual } = assert

module.exports = function () {
  it('should be an accepted claim', async function () {
    const agent = this.agent()
    const purpose = 'some text'
    const claims = {
      id_token: {
        assertion_claims: {
          given_name: { purpose, assertion: { $eq: 'José' } },
          birthdate: { assertion: { $lt: '2000-01-10' } },
          phone_number: { assertion: { $eq: '07523-503388' } },
          total_balance: { assertion: { amount: { $gt: '999.00' } } }
        }
      }
    }
    const requestObject = { ...DEFAULT_REQUEST_OBJECT, claims }
    const uri = await this.goToSecondInteraction(agent, { requestObject })
    const resolvedClaims = new ClaimResponse({
      given_name: new Claim([new Resolved('José', 2)]),
      birthdate: new Claim([new Resolved('1979-08-18', 2)]),
      phone_number: new Claim([new Resolved('+447523503388', 2)]),
      total_balance: new Claim([new Resolved({ currency: 'GBP', amount: '1002.00' }, 2)])
    })
    const interactionId = getInteractionIdFromInteractionUri(uri)
    const expected = {
      claims: {
        id_token: {
          assertion_claims: {
            given_name: { ial: 1, purpose, assertion: { $eq: 'José' }, result: ['Jo****sé'], unresolved: [] },
            birthdate: { ial: 1, assertion: { $lt: '2000-01-10' }, result: ['1979-08-18'], unresolved: [] },
            phone_number: { ial: 1, assertion: { $eq: '07523-503388' }, result: ['******3388'], unresolved: [] },
            total_balance: {
              ial: 1,
              assertion: { amount: { $gt: '999.00' } },
              result: [{ currency: 'GBP', amount: '1002.00' }],
              unresolved: []
            }
          }
        },
        userinfo: {
          assertion_claims: {}
        }
      },
      client: CLIENT,
      interaction: 'consent',
      scopes: ['openid'],
      interaction_id: interactionId,
      redirect_uri: 'http://127.0.0.1:8080/cb',
      interaction_path: `/interaction/${interactionId}/consent`
    }
    await this.secondInteraction(agent, uri, { resolvedClaims }).expect(expected)
    assert(this.claimStub.calledOnceWith(AUTH, {
      given_name: { ials: [1] },
      birthdate: { ials: [1] },
      phone_number: { ials: [1] },
      total_balance: { ials: [1] }
    }))
  })
  ;[
    ['current', { assertions: { given_name: 0, family_name: 29, email: -1 } }],
    ['legacy', { approved_assertions: ['given_name', 'family_name'] }]
  ].forEach(([name, consentIdToken]) => {
    it(`should be accepted or declined at consent endpoint (${name})`, async function () {
      const agent = this.agent()
      const assertions = {
        given_name: { assertion: { $eq: 'José' } },
        family_name: { assertion: { $eq: 'Gómez' } },
        email: { assertion: { $eq: 'jose.gomez@santander.co.uk' } },
        birthdate: { assertion: { $lte: '2000-01-01' } }
      }
      const claims = { id_token: { assertion_claims: assertions } }

      const requestObject = { ...DEFAULT_REQUEST_OBJECT, claims }
      const resolvedClaims = new ClaimResponse({
        given_name: new Claim([new Resolved('José', 2)]),
        family_name: new Claim([]),
        email: new Claim([new Resolved('jose.gomez@santander.co.uk', 2)]),
        birthdate: new Claim([new Resolved('1979-04-04', 2)])
      })
      const uri = await this.goToConsent(agent, { requestObject, resolvedClaims })
      const consentRequest = { id_token: consentIdToken, approved_scopes: ['openid'] }
      const { header: { location } } =
        await this.consent(agent, getInteractionIdFromInteractionUri(uri), { consentRequest })
      const code = new URL(location).searchParams.get('code')
      const { body: { id_token: idTokenStr } } = await this.token(agent, code)
      const idToken = jwtVerify(idTokenStr)
      deepStrictEqual(idToken.assertion_claims, { given_name: { result: true }, family_name: { result: false } })
    })

    it(`should fail if user accept an assertion claim that is not been requested (${name})`, async function () {
      const agent = this.agent()
      const assertion = { $eq: 'José' }
      const claims = {
        id_token: { assertion_claims: { given_name: { assertion } } }
      }
      const requestObject = { ...DEFAULT_REQUEST_OBJECT, claims }
      const resolvedClaims = new ClaimResponse({ given_name: new Claim([new Resolved('José', 2)]) })

      const interactionId = await this.goToConsent(agent, { resolvedClaims, requestObject })
      await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH).send({
        id_token: consentIdToken,
        approved_scopes: ['openid']
      }).expect(400, error('invalid_request',
        'family_name could not be accepted as it has not been requested at id_token assertions'))
    })

    it(`should return an error when any operator is not recognized (${name})`, async function () {
      const agent = this.agent()
      const assertions = {
        given_name: { assertion: { $eq: 'José' } },
        family_name: { assertion: { $unknown_operator: 'Gómez' } },
        email: { assertion: { $eq: 'jose.gomez@santander.co.uk' } },
        birthdate: {},
        custard_apple: { assertion: { $eq: 'This is not a banana' } }
      }
      const claims = { id_token: { assertion_claims: assertions } }

      const requestObject = { ...DEFAULT_REQUEST_OBJECT, claims }
      const uri = await this.goToSecondInteraction(agent, { requestObject })
      const resolvedClaims = new ClaimResponse({
        given_name: new Claim([new Resolved('José', 2)]),
        family_name: new Claim([new Resolved('Gómez', 2), new Resolved('GOMEZ', 2)]),
        email: new Claim([new Resolved('jose.gomez@santander.co.uk', 2)]),
        birthdate: new Claim([new Resolved('jose.gomez@santander.co.uk', 2)])
      })
      const interactionId = getInteractionIdFromInteractionUri(uri)
      await this.secondInteraction(agent, uri, { resolvedClaims }).expect({
        claims: {
          id_token: {
            assertion_claims: {
              given_name: { ial: 1, assertion: { $eq: 'José' }, result: ['Jo****sé'], unresolved: [] },
              family_name: { ial: 1, assertion: { $unknown_operator: 'Gómez' }, result: [], unresolved: [{ type: 'unknown_operator' }] },
              email: { ial: 1, assertion: { $eq: 'jose.gomez@santander.co.uk' }, result: ['j****z@santander.co.uk'], unresolved: [] },
              birthdate: { ial: 1, result: [], unresolved: [{ type: 'syntax_error' }] }
            }
          },
          userinfo: {
            assertion_claims: {}
          }
        },
        client: CLIENT,
        interaction: 'consent',
        scopes: ['openid'],
        interaction_id: interactionId,
        redirect_uri: 'http://127.0.0.1:8080/cb',
        interaction_path: `/interaction/${interactionId}/consent`
      })
      const consentRequest = { id_token: consentIdToken, approved_scopes: ['openid'] }
      const { header: { location } } =
        await this.consent(agent, getInteractionIdFromInteractionUri(uri), { consentRequest })
      const code = new URL(location).searchParams.get('code')
      const { body: { id_token: idTokenStr } } = await this.token(agent, code)
      const idToken = jwtVerify(idTokenStr)
      deepStrictEqual(idToken.assertion_claims, {
        given_name: { result: true },
        family_name: { error: 'unknown_operator', result: null }
      })
    })
  })
  it('should check if assertions are objects and the indexes are integers', async function () {
    const agent = this.agent()
    const claims = {
      id_token: {
        assertion_claims: {
          given_name: { assertion: { $eq: 'José' } }
        }
      }
    }
    const requestObject = { ...DEFAULT_REQUEST_OBJECT, claims }
    const resolvedClaims = new ClaimResponse({
      given_name: new Claim([new Resolved('José', 2)])
    })

    const interactionId = await this.goToConsent(agent, { requestObject, resolvedClaims })

    // TODO refactor
    await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
      .send({ id_token: { assertions: [] }, approved_scopes: ['openid'] })
      .expect(400, error('invalid_request', 'assertions must be an object'))

    await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
      .send({ id_token: { assertions: { given_name: 'a' } }, approved_scopes: ['openid'] })
      .expect(400, error('invalid_request', 'index a is not valid for given_name assertion claim at id_token'))

    await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
      .send({ id_token: { assertions: { given_name: -0.3 } }, approved_scopes: ['openid'] })
      .expect(400, error('invalid_request', 'index -0.3 is not valid for given_name assertion claim at id_token'))

    await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
      .send({ id_token: { assertions: { given_name: -2 } }, approved_scopes: ['openid'] })
      .expect(400, error('invalid_request', 'index -2 is not valid for given_name assertion claim at id_token'))
  })
}
