'use strict'

const assert = require('assert')
const { strictEqual, deepStrictEqual } = assert
const { it } = require('mocha')
const {
  jwtVerify, OP_ID, CLIENT_ID, CLIENT, REDIRECT_URI, DEFAULT_REQUEST_OBJECT,
  INTERACTION_PATH, CONSENT_PATH, getInteractionIdFromInteractionUri
} = require('./fixtures')
const { ClaimResponse, Claim } = require('../../lib/resolvers')

module.exports = function () {
  it('should complete a happy path', async function () {
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

    const interactionUri = await this.goToInteraction(agent, { requestObject })
    const interactionId = getInteractionIdFromInteractionUri(interactionUri)
    await agent.get(interactionUri)
      .expect(200, {
        interaction: 'login',
        acr: 'any',
        interaction_id: interactionId,
        redirect_uri: 'http://127.0.0.1:8080/cb',
        interaction_path: `/interaction/${interactionId}/login`
      })
      .expect(({ body }) => {
        strictEqual(body.interaction, 'login')
        strictEqual(body.acr, 'any')
        assert(body.interaction_id.length > 0)
      })

    const { header: { location: interactionUri2 } } = await this.login(agent, interactionId)
      .expect(({ header: { location } }) => {
        assert(location.startsWith('/interaction'))
      })

    const claims = {
      given_name: new Claim(['Juan José']),
      family_name: new Claim(['Ramírez Escribano']),
      total_balance: new Claim([{ amount: '10.23', currency: 'GBP' }]),
      birthdate: new Claim(['2000-01-10']),
      email: new Claim(['custard.apple@santander.co.uk']),
      phone_number: new Claim(['1234567890', '9456787767'])
    }
    const resolvedClaims = new ClaimResponse(claims)

    const { body: { interaction_id: interactionId2 } } = await this.secondInteraction(agent, interactionUri2, { resolvedClaims }).expect({
      client: CLIENT,
      claims: {
        purpose: 'general purpose',
        id_token: {
          given_name: { essential: true, purpose: 'id_token given_name purpose', result: ['Ju****sé'], unresolved: [] },
          total_balance: { essential: true, purpose: 'id_token total_balance purpose', result: claims.total_balance.resolved, unresolved: [] }
        },
        userinfo: {
          family_name: { purpose: 'userinfo family_name purpose', result: ['Ra****no'], unresolved: [] },
          given_name: { essential: true, purpose: 'userinfo given_name purpose', result: ['Ju****sé'], unresolved: [] },
          total_balance: { essential: true, purpose: 'userinfo total_balance purpose', result: claims.total_balance.resolved, unresolved: [] },
          email: { essential: true, purpose: 'userinfo email purpose', result: ['c****e@santander.co.uk'], unresolved: [] },
          phone_number: { essential: true, purpose: 'userinfo phone_number purpose', result: ['******7890', '******7767'], unresolved: [] },
          birthdate: { essential: true, purpose: 'userinfo birthdate purpose', result: claims.birthdate.resolved, unresolved: [] }
        }
      },
      interaction: 'consent',
      scopes: ['openid'],
      interaction_id: interactionId,
      redirect_uri: 'http://127.0.0.1:8080/cb',
      interaction_path: `/interaction/${interactionId}/consent`
    })

    const { header: { location } } = await agent
      .post(INTERACTION_PATH + interactionId2 + CONSENT_PATH)
      .send({
        id_token: {
          approved_claims: ['given_name', 'total_balance']
        },
        userinfo: {
          approved_claims: ['family_name', 'total_balance', 'email', 'phone_number', 'birthdate']
        },
        approved_scopes: ['openid']
      })
      .expect(302)
    assert(location.startsWith(REDIRECT_URI))

    const code = new URL(location).searchParams.get('code')
    const {
      body: {
        scope, token_type: tokenType,
        id_token: idTokenStr,
        access_token: accessToken
      }
    } = await this.token(agent, code)

    strictEqual(scope, 'openid')
    strictEqual(tokenType, 'Bearer')

    const idToken = jwtVerify(idTokenStr)

    strictEqual(idToken.iss, OP_ID)
    strictEqual(idToken.aud, CLIENT_ID)
    deepStrictEqual(idToken.given_name, claims.given_name.resolved[0])
    deepStrictEqual(idToken.total_balance, claims.total_balance.resolved[0])

    await agent.get('/me')
      .set('Authorization', 'Bearer ' + accessToken)
      .expect(200, {
        sub: 'e3def28859bc43cad610082f60d663e431f73d1c7a26fc06d8c67ab730978e6f',
        family_name: claims.family_name.resolved[0],
        total_balance: claims.total_balance.resolved[0],
        email: claims.email.resolved[0],
        phone_number: claims.phone_number.resolved[0],
        birthdate: claims.birthdate.resolved[0]
      })
  })

  it('should allow execute the flow two times in same agent (cookies)', async function () {
    const agent = this.agent()
    const code = await this.goToToken(agent)
    await this.token(agent, code)

    const requestObject = { nonce: 'other-nonce', ...DEFAULT_REQUEST_OBJECT }
    const { body } = await this.initiateAuthorize(agent, { requestObject })

    await this.authorize(agent, body.request_uri)
      .expect(302)
      .expect(({ header, body }) => {
        assert(header.location.startsWith('/interaction/'), 'Redirection to /interaction endpoint')
      })
  })
}
