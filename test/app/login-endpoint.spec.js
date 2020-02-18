'use strict'

const { describe, it, before, after } = require('mocha')
const sinon = require('sinon')
const {
  error, getInteractionIdFromInteractionUri,
  USER, PASS, LOGIN_PATH, INTERACTION_PATH
} = require('./fixtures')
const { UnauthorizedError } = require('../../lib/resolvers')
const assert = require('assert')
const { strictEqual } = assert

module.exports = function () {
  it('should redirect to interaction when login succeeded', async function () {
    const agent = this.agent()
    const interactionUrl = await this.goToInteraction(agent)
    const interactionId = getInteractionIdFromInteractionUri(interactionUrl)
    await this.interaction(agent, interactionUrl)
    await this.login(agent, interactionId)
      .expect('location', interactionUrl)

    assert(this.loginStub.calledOnceWith(USER, PASS))
  })

  it('should fail when "session_id" is missing in the request', async function () {
    await this.request.post(LOGIN_PATH)
      .send({ user: USER, pass: PASS })
      .expect(404)
  })

  it('should fail when interaction session does not exist', async function () {
    await this.request.post(INTERACTION_PATH + 'fakeSessionId' + LOGIN_PATH)
      .send({ user: USER, pass: PASS })
      .expect(404, error('session_not_found', 'interaction session id cookie not found'))
  })

  it('should fail with 400 if the JSON parser reports an error [DIGITALID-228]', async function () {
    const agent = this.agent()
    const interactionId = await this.goToLogin(agent)
    await agent.post(INTERACTION_PATH + interactionId + LOGIN_PATH)
      .set('Content-Type', 'application/json')
      .send('{ "user": "xsstest%00"<>\'", "pass": "13579" }')
      .expect(400, error('invalid_request', 'Unexpected token < in JSON at position 22'))
  })

  it('should return an error if authentication fails', async function () {
    const agent = this.agent()
    const interactionId = await this.goToLogin(agent)

    this.loginStub.throws(() => new UnauthorizedError('Invalid Username or Password.'))

    await agent.post(INTERACTION_PATH + interactionId + LOGIN_PATH)
      .send({ user: USER, pass: PASS })
      .expect(401, error('invalid_credential', 'Invalid Username or Password.'))
  })

  it('should not fail if the login is called twice', async function () {
    const agent = this.agent()
    const interactionId = await this.goToLogin(agent)
    await this.login(agent, interactionId)
    await this.login(agent, interactionId)
  })

  describe('Interaction Session Longer Than User Session', function () {
    before('set up fake timers', function () {
      this.clock = sinon.useFakeTimers()
    })
    after('restore fake timers', function () {
      this.clock.restore()
    })
    it('should ask for a new login instead of going to interaction directly', async function () {
      const agent = this.agent()
      await this.goToSecondInteraction(agent)
      const short = this.cookies.short.maxAge
      const long = this.cookies.long.maxAge
      const diff = long - short + 1
      this.clock.tick(diff)
      const interactionURI = await this.goToInteraction(agent)
      const res = await this.interaction(agent, interactionURI)
      strictEqual(res.body.interaction, 'login')
    })
  })
}
