
const { it } = require('mocha')
const {
  INTERACTION_PATH, ABORT_PATH, CONSENT_PATH, error
} = require('./fixtures')
const assert = require('assert')
const { strictEqual } = assert
const cookieParser = require('set-cookie-parser')

module.exports = function () {
  const SEND_BODY = {
    id_token: { approved_claims: ['given_name'] },
    approved_scopes: ['openid']
  }

  it('should redirect correctly and remove interaction session', async function () {
    const agent = this.agent()
    const interactionId = await this.goToConsent(agent)

    const { header: { location, 'set-cookie': cookiesArray } } = await agent.post(INTERACTION_PATH + interactionId + ABORT_PATH)
      .send(SEND_BODY)
      .expect(302)

    const cookies = cookieParser.parse(cookiesArray)
    const cookieInteraction = cookies.find((cookie) => cookie.name === this.cookies.names.interaction)
    const cookieResume = cookies.find((cookie) => cookie.name === this.cookies.names.resume)
    const cookieInteractionSig = cookies.find((cookie) => cookie.name === this.cookies.names.interaction + '.sig')
    const cookieResumeSig = cookies.find((cookie) => cookie.name === this.cookies.names.resume + '.sig')

    strictEqual(location, 'http://127.0.0.1:8080/cb?error=access_denied&error_description=End-User%20aborted%20interaction')
    strictEqual(cookieResume.value, '')
    strictEqual(cookieInteraction.value, '')
    strictEqual(cookieInteractionSig.expires.getTime(), 0)
    strictEqual(cookieResumeSig.expires.getTime(), 0)
    strictEqual(cookieResume.expires.getTime(), 0)
    strictEqual(cookieInteraction.expires.getTime(), 0)

    await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
      .send(SEND_BODY)
      .expect(404, error('session_not_found', 'interaction session id cookie not found'))
  })
}
