'use strict'

const { it, before } = require('mocha')
const sinon = require('sinon')
const { ok } = require('assert')

module.exports = function (cb) {
  before('register check event', function () {
    this.check = async (name, cb) => {
      const spy = sinon.spy()
      this.app.once(name, spy)
      await cb(this.agent())
      ok(spy.calledOnce)
    }
  })

  it('should fire "interaction.started" after authorize call', async function () {
    await this.check('interaction.started', (agent) => this.goToInteraction(agent))
  })

  it('should fire "interaction.ended" after last resume call', async function () {
    await this.check('interaction.ended', (agent) => this.goToToken(agent))
  })

  it('should fire "pushed_authorization_request.success" after initiate authorize call', async function () {
    await this.check('pushed_authorization_request.success', (agent) => this.initiateAuthorize(agent))
  })

  it('should fire "pushed_authorization_request.error" after initiate authorize call error', async function () {
    await this.check('pushed_authorization_request.error',
      (agent) => this.initiateAuthorize(agent, { requestObject: {} }, 400))
  })

  it('should fire "authorization.accepted" after consent', async function () {
    await this.check('authorization.accepted', (agent) => this.goToToken(agent))
  })

  it('should fire "authorization.error" after abort', async function () {
    await this.check('authorization.error', async (agent) =>
      this.abort(agent, await this.goToConsent(agent))
    )
  })

  it('should fire "redirect.authorize" after login', async function () {
    await this.check('redirect.authorize', (agent) => this.goToSecondInteraction(agent))
  })

  it('should fire "grant.success" after token', async function () {
    await this.check('grant.success', (agent) => this.goToUserinfo(agent))
  })

  it('should fire "grant.error" after token error', async function () {
    await this.check('grant.error', (agent) => this.token(agent, 'abcde', 400))
  })

  it('should fire "claims.consumed" after token', async function () {
    await this.check('claims.consumed', (agent) => this.goToUserinfo(agent))
  })

  it('should fire "login" after login', async function () {
    await this.check('login', (agent) => this.goToSecondInteraction(agent))
  })

  it('should fire "consent" after consent', async function () {
    await this.check('consent', (agent) => this.goToToken(agent))
  })

  it('should fire "interaction.login" after go to login', async function () {
    await this.check('interaction.login', (agent) => this.goToLogin(agent))
  })

  it('should fire "interaction.consent" after go to login', async function () {
    await this.check('interaction.consent', (agent) => this.goToConsent(agent))
  })

  it('should fire "abort" after abort', async function () {
    await this.check('abort', async (agent) => this.abort(agent, await this.goToConsent(agent)))
  })

  it('should fire "logout" after logout', async function () {
    await this.check('logout', async (agent) => {
      await this.goToSecondInteraction(agent)
      await this.logout(agent)
    })
  })
}
