'use strict'

const { it } = require('mocha')
const {
  TOKEN_PATH, NONCE,
  jwtSign, CLIENT_ASSERTION_TYPE, OP_ID, jwtVerify, INIT_PATH
} = require('./fixtures')
const assert = require('assert')
const { strictEqual, deepStrictEqual } = assert
const pkceChallenge = require('pkce-challenge')
const fs = require('fs')

module.exports = function () {
  const clientId = '835822af-ae41-4513-96b0-ec5b619b43a9'
  const redirectUri = 'com.jobs://authorized'
  const payloadAuth = {
    aud: OP_ID,
    iss: clientId,
    sub: clientId
  }
  const privateKey = fs.readFileSync('./test/resources/private-key-app.pem')
  const keyid = '2ES2JALtYkzvjaRXpOE6O-y8vR8fhZqrvXYlxvoBfx0'

  function jwtSignApp (payload) {
    return jwtSign(payload, { privateKey, keyid })
  }

  it('should work if challenge and verifier are ok', async function () {
    const pkce = pkceChallenge()
    const agent = this.agent()
    const requestObject = {
      iss: clientId,
      nonce: NONCE,
      aud: OP_ID,
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: pkce.code_challenge,
      code_challenge_method: 'S256',
      scope: 'openid',
      claims: {
        purpose: 'general purpose',
        id_token: {
          given_name: { essential: true, purpose: 'id_token given_name purpose' }
        }
      }
    }
    const jwtSec = jwtSignApp(payloadAuth)
    const jwtRequest = jwtSignApp(requestObject)
    const { body: { request_uri: requestURI } } = await agent.post(INIT_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .send(`request=${jwtRequest}`)
      .expect(201)
    const { header: { location: interactionUrl } } = await this.authorize(agent, requestURI, { clientId })
    const sessionId = interactionUrl.split('/').pop()
    await this.interaction(agent, interactionUrl)
    const { header: { location: interactionUrl2 } } = await this.login(agent, sessionId)
    await this.secondInteraction(agent, interactionUrl2)
    const { header: { location } } = await this.consent(agent, sessionId)
    const code = new URL(location).searchParams.get('code')
    assert(code.length > 0, 'code is not returned')
    const jwtSec2 = jwtSignApp(payloadAuth)
    const {
      body: {
        scope, token_type: tokenType,
        id_token: idTokenStr,
        access_token: accessToken
      }
    } = await agent.post(TOKEN_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec2}`)
      .send(`code=${code}`)
      .send('grant_type=authorization_code')
      .send(`redirect_uri=${redirectUri}`)
      .send(`code_verifier=${pkce.code_verifier}`)
      .expect(200)

    strictEqual(scope, 'openid')
    strictEqual(tokenType, 'Bearer')
    assert(accessToken.length > 0)

    const idToken = jwtVerify(idTokenStr)

    strictEqual(idToken.iss, OP_ID)
    strictEqual(idToken.aud, clientId)
    deepStrictEqual(idToken.given_name, 'Juan José')
  })
}
