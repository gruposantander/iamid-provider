
const { describe, it } = require('mocha')
const {
  error, CONSENT_PATH, INTERACTION_PATH, CLIENT_ID_ALT,
  DEFAULT_REQUEST_OBJECT, REQUEST_WITH_CLAIMS,
  getInteractionIdFromInteractionUri, PAYLOAD_AUTH_ALT
} = require('./fixtures')
const assert = require('assert')
const { notStrictEqual, strictEqual } = assert
const cookieParser = require('set-cookie-parser')

module.exports = function () {
  const template = (idToken) => ({ id_token: idToken, approved_scopes: ['openid'] })
  const SEND_BODY = template({ approved_claims: ['given_name'] })
  const SEND_ERROR_BODY = template({ approved_claims: ['given_name', 'email'] })
  const SEND_BODY_NEW = template({ claims: { given_name: 0 } })
  const SEND_ERROR_BODY_NEW = template({ claims: { given_name: 0, email: 0 } })

  const TEST_CONFIG = [[SEND_BODY, SEND_ERROR_BODY, 'Legacy'], [SEND_BODY_NEW, SEND_ERROR_BODY_NEW, 'Current']]

  TEST_CONFIG.forEach(([body, errorBody, text]) => {
    describe(text, function () {
      it('should return a code on success', async function () {
        const agent = this.agent()
        const interactionId = await this.goToConsent(agent)
        const { header: { location } } = await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
          .send(body)
          .expect(302)
        const code = new URL(location).searchParams.get('code')
        assert(code.length > 0, 'code is not returned')
      })

      it('should fail when the request accept more claims than the ones requested at initialization', async function () {
        const agent = this.agent()
        const interactionId = await this.goToConsent(agent)
        await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH).send(errorBody)
          .expect(400, error('invalid_request', 'email could not be accepted as it has not been requested at id_token'))
      })

      it('should fail when "interaction_id" is missing', async function () {
        const agent = this.agent()
        await this.goToConsent(agent)
        await agent.post(INTERACTION_PATH + CONSENT_PATH)
          .send(body)
          .expect(404, error('invalid_request', 'unrecognized route or not allowed method (POST on /interaction//consent)'))
      })

      it('should fail when interaction session does not exist', async function () {
        const agent = this.agent()
        await this.goToConsent(agent)
        await agent.post(INTERACTION_PATH + 'fakeSession' + CONSENT_PATH)
          .send(body)
          .expect(404, error('session_not_found', 'interaction session id cookie not found'))
      })

      it('should check expected parameters in the body', async function () {
        const agent = this.agent()
        const interactionId = await this.goToConsent(agent)
        await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
          .send({
            ...SEND_BODY,
            id_token: { approved_claims: 'given_name' }
          })
          .expect(400, error('invalid_request', 'approved_claims must be an array of strings'))
      })

      it('should ignore additional parameters in body', async function () {
        const agent = this.agent()
        const interactionId = await this.goToConsent(agent)
        await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
          .send({
            unresolved: { custard_apple: {} },
            ...body
          }).expect(302)
        // TODO check in database
      })

      it('should fail if the current interaction is not waiting for a consent', async function () {
        const agent = this.agent()
        const interactionId = await this.goToConsent(agent)
        await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
          .send(body)
          .expect(302)

        await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
          .send(body)
          .expect(404, error('session_not_found', 'interaction session not found'))
      })

      it('should fail when it is called before interaction request', async function () {
        const agent = this.agent()
        const interactionUri = await this.goToSecondInteraction(agent)
        const interactionId = getInteractionIdFromInteractionUri(interactionUri)

        await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
          .send(body)
          .expect(409, error('illegal_state', 'consent cannot be resolved before request'))
      })

      it('should fail when there is not an active session', async function () {
        const agent = this.agent()
        const { body: { request_uri: uri } } =
          await this.initiateAuthorize(agent, { requestObject: DEFAULT_REQUEST_OBJECT })
        const { headers: { 'set-cookie': cookiesArray, location } } = await this.authorize(agent, uri)
        const cookies = cookieParser.parse(cookiesArray)
        const { body: { interaction_id: interactionId } } = await this.interaction(agent, location)
        await this.login(agent, interactionId)
        await this.interaction(agent, location)
        await this.request.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
          .set('cookie', cookies
            .filter(({ name }) => name.startsWith('_interaction'))
            .reduce((str, { name, value }) => `${str}${name}=${value};`, ''))
          .send(body)
          .expect(401, error('session_not_found', 'user is not active'))
      })

      it('should fail when the user does not match with the one store in the current interaction', async function () {
        const agent = this.agent()
        const { body: { request_uri: uri } } = await this.initiateAuthorize(agent, { requestObject: DEFAULT_REQUEST_OBJECT })
        const { headers: { 'set-cookie': cookiesArray, location } } = await this.authorize(agent, uri)
        const cookies = cookieParser.parse(cookiesArray)
        const cookie = cookies.find((cookie) => cookie.name === '_interaction')
        const cookieSig = cookies.find((cookie) => cookie.name === '_interaction.sig')
        const { body: { interaction_id: interactionId } } = await this.interaction(agent, location)
        await this.login(agent, interactionId)
        await this.interaction(agent, location)
        const agent2 = this.agent()
        const interactionId2 = await this.goToLogin(agent2)
        const { headers: { 'set-cookie': cookiesArray2 } } = await this.login(agent2, interactionId2, { uid: 'juanjo2' })
        const cookies2 = cookieParser.parse(cookiesArray2)
        const cookie2 = cookies2.find((cookie) => cookie.name === '_session')
        await agent2.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
          .set('cookie', [cookie, cookieSig, cookie2]
            .reduce((str, { name, value }) => `${str}${name}=${value};`, ''))
          .send(body)
          .expect(403, error('incorrect_session', 'user does not match'))
      })

      it('should support two different consent request from different clients', async function () {
        const agent = this.agent()
        const interactionId = await this.goToConsent(agent)
        const options = {
          requestObject: { ...REQUEST_WITH_CLAIMS, iss: CLIENT_ID_ALT, client_id: CLIENT_ID_ALT },
          clientAssertionObject: PAYLOAD_AUTH_ALT,
          clientId: CLIENT_ID_ALT
        }
        const interactionId2 = await this.goToConsent(agent, options)
        notStrictEqual(interactionId, interactionId2)
        await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
          .send(body)
          .expect(302)
        await agent.post(INTERACTION_PATH + interactionId2 + CONSENT_PATH)
          .send(body)
          .expect(302)
      })

      it('should support two concurrent interactions with the same client', async function () {
        const agent = this.agent()
        await this.goToSecondInteraction(agent)
        const interactionURI = await this.goToInteraction(agent)
        const resp = await this.secondInteraction(agent, interactionURI)
        strictEqual(resp.body.interaction, 'consent')
        const interactionId = getInteractionIdFromInteractionUri(interactionURI)
        await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
          .send(body)
          .expect(302)
      })
    })
  })
  it('should check index constrains against the current resolved values', async function () {
    const agent = this.agent()
    const interactionId = await this.goToConsent(agent)
    await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
      .send({ id_token: { claims: { given_name: 1 } }, approved_scopes: ['openid'] })
      .expect(400, error('invalid_request', 'index 1 is not valid for given_name claim at id_token'))
  })
  it('should check if claims are objects and the indexes are integers', async function () {
    const agent = this.agent()
    const interactionId = await this.goToConsent(agent)

    // TODO refactor
    await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
      .send({ id_token: { claims: [] }, approved_scopes: ['openid'] })
      .expect(400, error('invalid_request', 'claims must be an object'))

    await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
      .send({ id_token: { claims: { given_name: 'a' } }, approved_scopes: ['openid'] })
      .expect(400, error('invalid_request', 'index a is not valid for given_name claim at id_token'))

    await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
      .send({ id_token: { claims: { given_name: -0.3 } }, approved_scopes: ['openid'] })
      .expect(400, error('invalid_request', 'index -0.3 is not valid for given_name claim at id_token'))

    await agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
      .send({ id_token: { claims: { given_name: -2 } }, approved_scopes: ['openid'] })
      .expect(400, error('invalid_request', 'index -2 is not valid for given_name claim at id_token'))
  })
}
