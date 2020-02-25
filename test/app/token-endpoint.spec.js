'use strict'

const { it } = require('mocha')
const { ClaimResponse, Claim, Resolved } = require('../../lib/resolvers')
const {
  TOKEN_PATH,
  PAYLOAD_AUTH, jwtSign, CLIENT_ASSERTION_TYPE, DEFAULT_REQUEST_OBJECT,
  REDIRECT_URI, OP_ID, CLIENT_ID, jwtVerify, error
} = require('./fixtures')
const { equal, deepEqual, ok } = require('assert').strict

module.exports = function () {
  const DEFAULT = {
    requestObject: {
      ...DEFAULT_REQUEST_OBJECT,
      claims: {
        id_token: {
          given_name: null,
          family_name: null,
          email: null
        }
      }
    },
    resolvedClaims: new ClaimResponse({
      given_name: new Claim([new Resolved('Juan José', 2), new Resolved('Juanjo', 2)]),
      family_name: new Claim([new Resolved('Ramírez', 2)]),
      email: new Claim([new Resolved('juanjose.ramirez@santander.co.uk')])
    })
  }

  const GO_TO_TOKEN_OPTIONS = [[
    'current',
    {
      ...DEFAULT,
      consentRequest: {
        id_token: { claims: { given_name: 1, email: -1 } },
        approved_scopes: ['openid']
      }
    },
    'Juanjo'
  ], ['legacy', { ...DEFAULT }, 'Juan José']]
  GO_TO_TOKEN_OPTIONS.forEach(([name, options, givenName]) => {
    it(`should return an "id_token" when sent the correct code (${name})`, async function () {
      const agent = this.agent()
      const code = await this.goToToken(agent, options)
      const jwtSec = jwtSign(PAYLOAD_AUTH)
      const {
        body: {
          scope, token_type: tokenType,
          id_token: idTokenStr,
          access_token: accessToken
        }
      } = await agent.post(TOKEN_PATH)
        .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
        .send(`client_assertion=${jwtSec}`)
        .send(`code=${code}`)
        .send('grant_type=authorization_code')
        .send(`redirect_uri=${REDIRECT_URI}`)
        .expect(200)

      equal(scope, 'openid')
      equal(tokenType, 'Bearer')
      ok(accessToken.length > 0)

      const idToken = jwtVerify(idTokenStr)
      ok(idToken.txn)
      equal(idToken.iss, OP_ID)
      equal(idToken.aud, CLIENT_ID)
      deepEqual(idToken.given_name, givenName)
      deepEqual(idToken.family_name, undefined)
      deepEqual(idToken.email, undefined)
    })
  })

  it('should fail when there is no authentication header', async function () {
    const agent = this.agent()
    const code = await this.goToToken(agent)
    await agent.post(TOKEN_PATH)
      .type('form')
      .send(`code=${code}`)
      .send('grant_type=authorization_code')
      .send(`redirect_uri=${REDIRECT_URI}`)
      .expect(400, error('invalid_request', 'no client authentication mechanism provided'))
  })

  it('should fail with a "basic" authentication', async function () {
    const agent = this.agent()
    const code = await this.goToToken(agent)
    await agent.post(TOKEN_PATH)
      .type('form')
      .set('Authorization', 'Basic VEVTVC0yNzU0ZWZhNzVlOGM0ZDExYTZkN2Y5NWI5MGNkOGU0MC1URVNUOmM4Yjg4ZTg3NTc' +
      '3MjQ5OWE4MWQ4YTU3NDY0NjljMWNiLVBBU1MtZDQ3ZjIxMzBlZTc5NDhhMmI3OWUzMWY3ZjJiMTBkMDA=')
      .send(`code=${code}`)
      .send('grant_type=authorization_code')
      .send(`redirect_uri=${REDIRECT_URI}`)
      .expect(401, error('invalid_client', 'client authentication failed'))
  })

  it('should fail when the "client_assertion" JWT format is invalid', async function () {
    const agent = this.agent()
    const code = await this.goToToken(agent)
    const jwtSec = jwtSign({ aud: OP_ID, iss: CLIENT_ID })

    await agent.post(TOKEN_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .send(`code=${code}`)
      .send('grant_type=authorization_code')
      .send(`redirect_uri=${REDIRECT_URI}`)
      .expect(401, error('invalid_client', 'client authentication failed'))
  })

  it('should fail when JWT is expired', async function () {
    const agent = this.agent()
    const code = await this.goToToken(agent)
    const jwtSec = jwtSign(PAYLOAD_AUTH, { expiresIn: -10 })
    await agent.post(TOKEN_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .send(`code=${code}`)
      .send('grant_type=authorization_code')
      .send(`redirect_uri=${REDIRECT_URI}`)
      .expect(401, error('invalid_client', 'client authentication failed'))
  })

  it('should fail when no "redirect_uri" match', async function () {
    const agent = this.agent()
    const code = await this.goToToken(agent)
    const jwtSec = jwtSign(PAYLOAD_AUTH)
    await agent.post(TOKEN_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .send(`code=${code}`)
      .send('grant_type=authorization_code')
      .send('redirect_uri=http://other.com/hi')
      .expect(400, error('invalid_grant', 'grant request is invalid'))
  })
  it('should return txn as consent id', async function () {
    const agent = this.agent()
    const code = await this.goToToken(agent)
    const { body: { id_token: tokenStr } } = await this.token(agent, code)
    const { txn } = jwtVerify(tokenStr)
    const consents = await this.repositories.getRepository('consents')
    const consent = await consents.findById(txn)
    ok(consent)
  })
}
