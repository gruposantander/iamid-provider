'use strict'

const { it } = require('mocha')
const {
  DEFAULT_REQUEST_OBJECT, CONSENT_PATH, INTERACTION_PATH, SEND_BODY, requestWithClaims,
  LOGOUT_PATH, error, getInteractionIdFromInteractionUri
} = require('./fixtures')

module.exports = function () {
  const LOGOUT_REDIRECT_URI = 'https://www.santander.co.uk'
  const COOKIES = '_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; httponly,' +
    '_session.legacy=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; httponly'

  it('should remove user session', async function () {
    const agent = this.agent()
    const requestObject = { ...DEFAULT_REQUEST_OBJECT, ...requestWithClaims }

    const interactionUri = await this.goToSecondInteraction(agent, { requestObject })
    await this.secondInteraction(agent, interactionUri)

    await agent.post(LOGOUT_PATH)
      .expect(302)
      .expect('set-cookie', COOKIES)

    await agent.post(INTERACTION_PATH + getInteractionIdFromInteractionUri(interactionUri) + CONSENT_PATH)
      .send(SEND_BODY)
      .expect(404, error('session_not_found', 'session not found'))
  })

  it('should redirect to logoff URL when there is not an user session', async function () {
    return this.request.post(LOGOUT_PATH)
      .expect(302)
      .expect('set-cookie', COOKIES)
      .expect('location', LOGOUT_REDIRECT_URI)
  })
}
