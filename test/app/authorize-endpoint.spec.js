'use strict'

const { it } = require('mocha')
const assert = require('assert')
const { strictEqual } = assert
const {
  AUTH_PATH, CLIENT_ID, NONCE, CLIENT_ID_ALT, REDIRECT_URI,
  getInteractionIdFromInteractionUri
} = require('./fixtures')

module.exports = function () {
  function authorize (agent, requestURI) {
    return agent.get(AUTH_PATH)
      .query({ request_uri: requestURI, client_id: CLIENT_ID })
  }

  it('should redirect to interaction URL when authorization is correct', async function () {
    const agent = this.agent()
    const { body } = await this.initiateAuthorize(agent)

    const res = await authorize(agent, body.request_uri)
      .expect(302)
      .expect(({ header, body }) => {
        assert(header.location.startsWith('/interaction/'))
      })

    getInteractionIdFromInteractionUri(res.header.location)
  })

  it('should use "whitelist" merging strategy: only "response_mode" or "prompt" could be override ignoring other parameters', async function () {
    const agent = this.agent()
    const { body } = await this.initiateAuthorize(agent)
    const requestURI = body.request_uri

    const response = await agent.get(AUTH_PATH)
      .query({
        nonce: 'value',
        request_uri: requestURI,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'openid profile'
      })
      .expect(302)
    assert(response.header.location.startsWith('/interaction/'))
    const { params } = this.ctx.oidc
    strictEqual(params.nonce, NONCE)
    strictEqual(params.redirect_uri, 'http://127.0.0.1:8080/cb')
    strictEqual(params.scope, 'openid')
  })

  it('should fail when "client_id" is missing', async function () {
    await this.request
      .get(AUTH_PATH)
      .expect(400)
      .expect(({ text }) => {
        assert(text.includes('client_id'))
      })
  })

  it('should fail when "request_uri" is missing', function () {
    return this.request
      .get(AUTH_PATH)
      .query({ client_id: CLIENT_ID })
      .expect(302)
      .expect((response) => {
        const location = new URL(response.header.location)
        strictEqual(location.searchParams.get('error_description'), 'request_uri must be present')
      })
  })

  it('should fail when "request_uri" is not internal (it must be an URN)', function () {
    return this.request
      .get(AUTH_PATH)
      .query({ request_uri: 'https://santander.co.uk', client_id: CLIENT_ID })
      .expect(302)
      .expect((response) => {
        const location = new URL(response.header.location)
        strictEqual(location.searchParams.get('error_description'), 'request_uri must be an URN')
      })
  })

  it('should fail when "request_uri" does not exist', function () {
    return this.request
      .get(AUTH_PATH)
      .query({ request_uri: 'urn:op.example:NotFound', client_id: CLIENT_ID })
      .expect(302)
      .expect((response) => {
        const location = new URL(response.header.location)
        strictEqual(location.searchParams.get('error_description'), 'request_uri is invalid or expired')
      })
  })

  it('should fail when using a "request_uri" from another client (RP)', async function () {
    const agent = this.agent()
    const { body } = await this.initiateAuthorize(agent)
    const requestURI = body.request_uri
    await agent.get(AUTH_PATH)
      .query({ request_uri: requestURI, client_id: CLIENT_ID_ALT })
      .expect(302)
      .expect((response) => {
        const location = new URL(response.header.location)
        strictEqual(location.searchParams.get('error_description'),
          'request client_id must equal the one in request parameters')
      })
  })
}
