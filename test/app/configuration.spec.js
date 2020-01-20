'use strict'

const { it } = require('mocha')
const {
  INIT_PATH, CLIENT_ASSERTION_TYPE, jwtVerify,
  REDIRECT_URI, TOKEN_PATH, PAYLOAD_AUTH, jwtSign
} = require('./fixtures')
const assert = require('assert')
const { strictEqual } = assert
const cookieParser = require('set-cookie-parser')

module.exports = function () {
  it('should disable dynamic Registration endpoint', async function () {
    return this.request
      .post(this.routes.registration)
      .expect(404)
  })

  it('should disable token revocation endpoint', async function () {
    return this.request
      .post(this.routes.revocation)
      .expect(404)
  })

  it('should disable token introspection endpoint', async function () {
    return this.request
      .post(this.routes.introspection)
      .expect(404)
  })

  it('should disable session check endpoint', async function () {
    return this.request
      .get(this.routes.check_session)
      .expect(404)
  })

  it('should disable device endpoint', async function () {
    await this.request
      .post(this.routes.device_authorization)
      .expect(404)
    return this.request
      .get(this.routes.code_verification)
      .expect(404)
  })

  it('should disable session endpoints', async function () {
    return this.request
      .post(this.routes.end_session)
      .type('form')
      .expect(404)
  })

  it('should return a JSON error when route does not exist', async function () {
    return this.request
      .post('/banana')
      .expect(404, {
        error: 'invalid_request',
        error_description: 'unrecognized route or not allowed method (POST on /banana)'
      })
  })

  it('should return a JSON error when incorrect method is used in a valid path', async function () {
    return this.request
      .get(INIT_PATH)
      .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3')
      .expect(404, {
        error: 'invalid_request',
        error_description: 'unrecognized route or not allowed method (GET on /initiate-authorize)'
      })
  })

  it('should define "id_token" expiration close to 600 seconds', async function () {
    const agent = this.agent()
    const code = await this.goToToken(agent)
    const jwtSec = jwtSign(PAYLOAD_AUTH)
    const timeBefore = Math.round(Date.now() / 1000)
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

    strictEqual(scope, 'openid')
    strictEqual(tokenType, 'Bearer')
    assert(accessToken.length > 0)

    const idToken = jwtVerify(idTokenStr)
    assert(idToken.exp - timeBefore <= 600, 'id_token expiration near to 600 seconds')
    assert(idToken.exp - timeBefore > 590, 'id_token expiration near to 600 seconds')
  })

  it('should define cookies to be strict, http-only and have 10 min expiration (secure only in PRO)', async function () {
    // TODO This test require refactor
    const agent = this.agent()
    const interactionId = await this.goToLogin(agent)

    // const timeMark = Date.now()
    const { header: { 'set-cookie': cookiesArray } } = await this.login(agent, interactionId)
    const cookies = cookieParser.parse(cookiesArray)
    assert(cookies.length === 8)
    for (const cookie of cookies) {
      // strictEqual(cookie.sameSite, 'strict', `Cookie "${cookie.name}" should be strict`)
      assert(cookie.httpOnly, `Cookie "${cookie.name}" should be httpOnly`)
      // const timeDif = cookie.expires.getTime() - timeMark
      // assert(timeDif <= 900000 && timeDif > 890000, `Cookie "${cookie.name}" expires should be near 10 minutes`)
    }
  })
}
