'use strict'
const { it } = require('mocha')
const {
  INTERACTION_PATH, REDIRECT_URI, error,
  getInteractionIdFromInteractionUri, DEFAULT_REQUEST_OBJECT
} = require('./fixtures')
const cookieParser = require('set-cookie-parser')

module.exports = function () {
  it('should require login in first interaction', async function () {
    const agent = this.agent()
    const interactionUri = await this.goToInteraction(agent)
    const interactionId = getInteractionIdFromInteractionUri(interactionUri)
    const expected = {
      interaction: 'login',
      interaction_id: interactionId,
      interaction_path: `/interaction/${interactionId}/login`,
      redirect_uri: REDIRECT_URI,
      acr: 'any'
    }
    await agent.get(interactionUri).expect(200, expected)
  })

  it('should return "state" parameter in the body', async function () {
    const agent = this.agent()
    const requestObject = { ...DEFAULT_REQUEST_OBJECT, state: 'myState' }
    const interactionUri = await this.goToInteraction(agent, { requestObject })
    const interactionId = getInteractionIdFromInteractionUri(interactionUri)
    const expected = {
      interaction: 'login',
      interaction_id: interactionId,
      interaction_path: `/interaction/${interactionId}/login`,
      redirect_uri: REDIRECT_URI,
      state: 'myState',
      acr: 'any'
    }
    await agent.get(interactionUri).expect(200, expected)
  })

  it('should fail when "interaction_id" is missing in the request', async function () {
    return this.request.get(INTERACTION_PATH)
      .expect(404, error('invalid_request', 'unrecognized route or not allowed method (GET on /interaction/)'))
  })

  it('should fail when interaction session cookie is not send or does not exists', async function () {
    // Use a new request to not persist cookies
    return this.request.get(INTERACTION_PATH + 'fakeSession')
      .expect(404, error('session_not_found', 'interaction session id cookie not found'))
  })

  it('should return 404 when the interaction cookie value is incorrect', async function () {
    const agent = this.agent()
    const { body: { request_uri: requestURI } } = await this.initiateAuthorize(agent)
    const response = await this.authorize(agent, requestURI)
    const { header: { location: interactionUri, 'set-cookie': cookiesArray } } = response
    const cookies = cookieParser.parse(cookiesArray)
    const newCookies = cookies.reduce((str, { name, value }) => {
      if (name === '_interaction') {
        value = 'notValidValue'
      }
      return `${str}${name}=${value};`
    }, '')
    await this.request.get(interactionUri)
      .set('cookie', newCookies)
      .expect(404)
  })

  it('should check that "interaction" parameter in path and the cookie value match', async function () {
    const agent = this.agent()
    const { body: { request_uri: requestURI } } = await this.initiateAuthorize(agent)
    const { header: { 'set-cookie': cookiesArray } } = await this.authorize(agent, requestURI)
    const cookies = cookieParser.parse(cookiesArray)
    const newCookies = cookies.reduce((str, { name, value }) => {
      return `${str}${name}=${value};`
    }, '')
    await this.request.get(INTERACTION_PATH + 'WRONG_ONE')
      .set('cookie', newCookies)
      .expect(404, error('session_not_found', 'Interaction cookie does not match interaction path'))
  })
}
