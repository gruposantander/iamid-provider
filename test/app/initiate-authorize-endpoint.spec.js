'use script'

const assert = require('assert').strict
const { deepEqual } = assert
const { it } = require('mocha')
const {
  INIT_PATH, jwtSign, PAYLOAD_AUTH, NONCE,
  CLIENT_ID, OP_ID, REDIRECT_URI, CLIENT_ASSERTION_TYPE, DEFAULT_REQUEST_OBJECT, error
} = require('./fixtures')

module.exports = function () {
  const requestURIPrefix = 'urn:op.example:'

  it('should return "request_uri"', async function () {
    const assertion = jwtSign(PAYLOAD_AUTH, 30)
    const request = jwtSign(DEFAULT_REQUEST_OBJECT, 30)
    await this.initiateAuthorizeWithSigns(this.request, assertion, request)
      .expect(({ body }) => {
        assert(body.request_uri.startsWith(requestURIPrefix))
        assert(body.expires_in > 20 && body.expires_in <= 30)
        body.request_uri = requestURIPrefix
        body.expires_in = 30
      })
      .expect('x-dns-prefetch-control', 'off')
      .expect('x-download-options', 'noopen')
      .expect('x-content-type-options', 'nosniff')
      .expect('x-xss-protection', '1; mode=block')
      .expect('vary', 'Origin')
      .expect('pragma', 'no-cache')
      .expect('content-type', 'application/json; charset=utf-8')
      .expect('strict-transport-security', 'max-age=31536000; includeSubDomains')
      .expect('x-frame-options', 'DENY')
      .expect('content-security-policy', "default-src 'none'")
      .expect('referrer-policy', 'no-referrer')
      .expect('cache-control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      .expect(201, {
        expires_in: 30,
        request_uri: requestURIPrefix
      })
  })

  it('should fail if nonce is missing', async function () {
    const requestObject = {
      iss: CLIENT_ID,
      aud: OP_ID,
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'openid'
    }
    const jwtSec = jwtSign(PAYLOAD_AUTH, 30)
    const jwtRequest = jwtSign(requestObject, 30)
    await this.request.post(INIT_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .send(`request=${jwtRequest}`)
      .expect(400, error('invalid_request_object', 'missing required parameter \'nonce\''))
  })

  it('should fail when no "application/x-www-form-urlencoded" content type', async function () {
    const jwtSec = jwtSign(PAYLOAD_AUTH, 30)
    await this.request.post(INIT_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .set('Content-Type', 'application/json')
      .expect(400, error('invalid_request',
        'only application/x-www-form-urlencoded content-type bodies are ' +
        'supported on POST /initiate-authorize'))
  })

  it('should fail when there is no authorize method in the request', function () {
    return this.request.post(INIT_PATH)
      .type('form')
      .expect(400, error('invalid_request', 'no client authentication mechanism provided'))
  })

  it('should fail when expired JWT', async function () {
    const jwtSec = jwtSign(PAYLOAD_AUTH, { expiresIn: -10 })

    await this.request.post(INIT_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .expect(401, error('invalid_client', 'client authentication failed'))
  })

  it('should fail when incorrect JWT format', function () {
    const jwtSec = jwtSign({ aud: OP_ID, iss: CLIENT_ID }, 30)

    return this.request.post(INIT_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .expect(401, error('invalid_client', 'client authentication failed'))
  })

  it('should fail when no "request" parameter', function () {
    const jwtSec = jwtSign(PAYLOAD_AUTH, 30)

    return this.request.post(INIT_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .expect(400, error('invalid_request', 'Request Object must be present'))
  })

  it('should fail when "request" parameter is expired', function () {
    const jwtSec = jwtSign(PAYLOAD_AUTH)

    const jwtRequest = jwtSign({
      iss: CLIENT_ID,
      aud: OP_ID,
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'openid',
      nonce: 'test'
    }, { expiresIn: -10 })

    return this.request.post(INIT_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .send(`request=${jwtRequest}`)
      .expect(400, error('invalid_request_object', 'Request Object claims are invalid (jwt expired)'))
  })

  it('should respond normally if expiration is less than 5 seconds', function () {
    const jwtSec = jwtSign(PAYLOAD_AUTH, -1)

    const jwtRequest = jwtSign({
      iss: CLIENT_ID,
      aud: OP_ID,
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      nonce: 'banana',
      scope: 'openid'
    }, -1)

    return this.request.post(INIT_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .send(`request=${jwtRequest}`)
      .expect(({ body }) => {
        assert(body.request_uri.startsWith(requestURIPrefix))
        body.request_uri = requestURIPrefix
        body.expires_in = 30
      })
      .expect(201, {
        expires_in: 30,
        request_uri: requestURIPrefix
      })
  })

  it('should fail when request param contain unsupported "response_type" parameter', function () {
    const jwtSec = jwtSign(PAYLOAD_AUTH, 30)

    const jwtRequest = jwtSign({
      iss: CLIENT_ID,
      aud: OP_ID,
      response_type: 'id_token',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'openid'
    }, 30)

    return this.request.post(INIT_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .send(`request=${jwtRequest}`)
      .expect(400, error('invalid_request_object', 'unsupported response_type requested'))
  })

  it('should not recognized additional parameters outside the JWT', function () {
    const jwtSec = jwtSign(PAYLOAD_AUTH, 30)

    const jwtRequest = jwtSign({
      iss: CLIENT_ID,
      aud: OP_ID,
      response_type: 'code',
      client_id: CLIENT_ID,
      nonce: 'hola',
      scope: 'openid'
    }, 30)

    // We sent a incorrect redirect_uri if this param is take into account should fail because is incorrect.
    return this.request.post(INIT_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .send(`request=${jwtRequest}`)
      .send('redirect_uri=http://incorrect.com')
      .expect(201)
  })

  it('should fail when any of OpenId mandatory parameters are missing', function () {
    const jwtSec = jwtSign(PAYLOAD_AUTH, 30)

    const jwtRequest = jwtSign({
      iss: CLIENT_ID,
      aud: OP_ID,
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'openid'
    }, 30)

    return this.request.post(INIT_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .send(`request=${jwtRequest}`)
      .expect(400, error('invalid_request_object', "missing required parameter 'response_type'"))
  })

  it('should not allow to send parameters in the form (only "request")', function () {
    const jwtSec = jwtSign(PAYLOAD_AUTH, 30)
    return this.request
      .post(INIT_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .send('response_type=code')
      .send('client_id=TEST-2754efa75e8c4d11a6d7f95b90cd8e40-TEST')
      .send(`redirect_uri=${REDIRECT_URI}`)
      .send('scope=openid')
      .expect(400, error('invalid_request', 'Request Object must be present'))
  })

  it('should not allow "basic" authentication', function () {
    return this.request.post(INIT_PATH)
      .set('Authorization',
        'Basic VEVTVC0yNzU0ZWZhNzVlOGM0ZDExYTZkN2Y5NWI5MGNkOGU0MC1URVNUOmM4Yjg4ZTg3NTc' +
        '3MjQ5OWE4MWQ4YTU3NDY0NjljMWNiLVBBU1MtZDQ3ZjIxMzBlZTc5NDhhMmI3OWUzMWY3ZjJiMTBkMDA=')
      .send('response_type=code')
      .send(`client_id=${CLIENT_ID}`)
      .send(`redirect_uri=${REDIRECT_URI}`)
      .send('scope=openid')
      .expect(401, error('invalid_client', 'client authentication failed'))
  })

  it('should only allow requests that contain "openid" scope', function () {
    const jwtSec = jwtSign(PAYLOAD_AUTH, 30)

    const jwtRequest = jwtSign({
      iss: CLIENT_ID,
      nonce: NONCE,
      aud: 'https://op.example.com',
      response_type: 'code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: 'other'
    }, 30)

    return this.request.post(INIT_PATH)
      .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
      .send(`client_assertion=${jwtSec}`)
      .send(`request=${jwtRequest}`)
      .expect(400, error('invalid_request_object', 'openid scope must be included for this endpoint'))
  })

  it('should report an error but not fail if there is a syntax error in assertions', async function () {
    // TODO validate more things like normal claims...
    const claims = {
      id_token: {
        assertion_claims: {
          given_name: { assertion: { eq: 'banana' } },
          family_name: { assertion: { $sj: 3 } },
          custard_apple: { assertion: { eq: 'not a banana' } }
        }
      },
      userinfo: {
        assertion_claims: {
          given_name: { assertion: [] },
          family_name: { },
          email: 3,
          birthdate: null,
          total_balance: { assertion: { $greater_than: 3 } }
        }
      }
    }
    const requestObject = { ...DEFAULT_REQUEST_OBJECT, claims }
    const response = await this.initiateAuthorize(this.request, { requestObject })
    deepEqual(response.body.errors, [
      { group: 'id_token.assertion_claims', key: 'family_name', description: 'unknown operator: $sj' },
      { group: 'id_token.assertion_claims', key: 'custard_apple', description: 'assertions not supported on this claim' },
      { group: 'userinfo.assertion_claims', key: 'given_name', description: 'expression should be an object' },
      { group: 'userinfo.assertion_claims', key: 'family_name', description: 'expression should be an object' },
      { group: 'userinfo.assertion_claims', key: 'email', description: 'expression should be an object' },
      { group: 'userinfo.assertion_claims', key: 'birthdate', description: "Cannot read property 'assertion' of null" },
      { group: 'userinfo.assertion_claims', key: 'total_balance', description: 'unknown operator: $greater_than' }])
  })
}
