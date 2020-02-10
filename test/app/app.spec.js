'use strict'

const { describe, before, after, afterEach } = require('mocha')
const { IAmId, Configuration } = require('../../')
const request = require('supertest')
const sinon = require('sinon')
const { MongoMemoryServer } = require('mongodb-memory-server')

const InteractionRouter = require('../fixtures/reference-interaction-router')

const {
  jwtSign, AUTH_PATH,
  RESOLVED_CLAIMS, CLIENT_ASSERTION_TYPE, CONSENT_PATH,
  AUTH, USER, PASS, INTERACTION_PATH, REDIRECT_URI, CLIENT_ID,
  LOGIN_PATH, PAYLOAD_AUTH, TOKEN_PATH, REQUEST_WITH_CLAIMS, INIT_PATH
} = require('./fixtures')

const handler = {
  get: function (target, propertyName) {
    const property = target[propertyName]
    if (propertyName === 'post' || propertyName === 'get') {
      return function () {
        return property.call(target, ...arguments)
          .set('X-Forwarded-Host', 'myid.io')
          .set('X-Forwarded-Proto', 'https')
      }
    }
    return property
  }
}

const suite = function () {
  before('instance and stubs', async function () {
    const resolve = sinon.stub()
    const login = sinon.stub()
    this.app = new IAmId(Configuration.newInstance()
      .pushEnvironment(this.environment)
      .pushSecrets(this.secrets)
      .build())
    this.app.use(new InteractionRouter(this.app, login, resolve).routes())

    await this.app.init()
    this.claimStub = resolve
    this.loginStub = login
  })

  afterEach('reset stubs', function () {
    this.claimStub.reset()
    this.loginStub.reset()
  })

  before('Register provided middleware', function () {
    this.app.provider.use(async (ctx, next) => {
      await next()
      this.ctx = ctx
    })
  })

  before('Start server and set up request', function (cb) {
    this.server = this.app.listen(6000, cb)
    this.request = new Proxy(request(this.server), handler)
    this.agent = () => new Proxy(request.agent(this.server), handler)
    this.routes = this.app.provider.configuration('routes')
    this.cookies = this.app.provider.configuration('cookies')
  })

  before('Set utility methods', function () {
    this.initiateAuthorizeWithSigns = (agent, assertion, request) => {
      return agent.post(INIT_PATH)
        .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
        .send(`client_assertion=${assertion}`)
        .send(`request=${request}`)
        .expect(201)
    }

    this.initiateAuthorize = (agent, options = {}) => {
      const { requestObject = REQUEST_WITH_CLAIMS, clientAssertionObject = PAYLOAD_AUTH } = options
      const jwtSec = jwtSign(clientAssertionObject)
      const jwtRequest = jwtSign(requestObject)
      return this.initiateAuthorizeWithSigns(agent, jwtSec, jwtRequest)
    }
    this.authorize = (agent, requestUri, options = {}) => {
      const { clientId = CLIENT_ID } = options
      return agent.get(AUTH_PATH)
        .query({ request_uri: requestUri, client_id: clientId })
        .expect(302)
    }
    this.interaction = (agent, interactionURI) => {
      return agent.get(interactionURI).expect(200)
    }
    this.consent = (agent, interactionId, options = {}) => {
      const {
        consentRequest = {
          id_token: { approved_claims: ['given_name'] },
          approved_scopes: ['openid']
        }
      } = options
      return agent.post(INTERACTION_PATH + interactionId + CONSENT_PATH)
        .send(consentRequest)
        .expect(302)
    }
    this.goToInteraction = async (agent, options) => {
      const { body: { request_uri: requestURI } } = await this.initiateAuthorize(agent, options)
      const { header: { location: interactionURI } } = await this.authorize(agent, requestURI, options)
      return interactionURI
    }
    this.goToLogin = async (agent, options) => {
      const interactionURI = await this.goToInteraction(agent, options)
      const { body: { interaction_id: interactionId } } = await this.interaction(agent, interactionURI)
      return interactionId
    }
    this.login = (agent, interactionId, options) => {
      const { uid = AUTH } = { ...options }
      this.loginStub.resolves(uid)
      return agent.post(INTERACTION_PATH + interactionId + LOGIN_PATH)
        .send({ user: USER, pass: PASS })
        .expect(302)
    }
    this.goToSecondInteraction = async (agent, options) => {
      const interactionId = await this.goToLogin(agent, options)
      const { header: { location: interactionURI } } = await this.login(agent, interactionId)
      return interactionURI
    }
    this.secondInteraction = (agent, interactionURI, options = {}) => {
      const { resolvedClaims = RESOLVED_CLAIMS } = options
      this.claimStub.resolves(resolvedClaims)
      // TODO test if this is really is the second interaction
      return this.interaction(agent, interactionURI)
    }
    this.goToConsent = async (agent, options) => {
      const interactionURI = await this.goToSecondInteraction(agent, options)
      const { body: { interaction_id: interactionId } } = await this.secondInteraction(agent, interactionURI, options)
      return interactionId
    }
    this.goToToken = async (agent, options) => {
      const interactionId = await this.goToConsent(agent, options)
      const { header: { location } } = await this.consent(agent, interactionId, options)
      return new URL(location).searchParams.get('code')
    }
    this.token = (agent, code) => {
      const jwtSec = jwtSign(PAYLOAD_AUTH)
      return agent.post(TOKEN_PATH)
        .send(`client_assertion_type=${CLIENT_ASSERTION_TYPE}`)
        .send(`client_assertion=${jwtSec}`)
        .send(`code=${code}`)
        .send('grant_type=authorization_code')
        .send(`redirect_uri=${REDIRECT_URI}`)
        .expect(200)
    }
    this.userinfo = (agent, accessToken) =>
      agent.get('/me').set('Authorization', 'Bearer ' + accessToken).expect(200)
  })

  after('Stop server', function (cb) {
    this.server.close(cb)
    this.app.close()
  })

  afterEach('clean consent repository', async function () {
    // TODO this is not going to be needed when every consent has its own id
    (await this.app.repositories.getRepository('consents')).clear()
  })

  describe('Wellknown Endpoints', require('./well-known-endpoints.spec'))
  describe('Initiate Authorize Endpoint', require('./initiate-authorize-endpoint.spec'))
  describe('Authorize Endpoint', require('./authorize-endpoint.spec'))
  describe('First Interaction Endpoint', require('./login-interaction-endpoint.spec'))
  describe('Login Endpoint', require('./login-endpoint.spec'))
  describe('Second Interaction Endpoint', require('./consent-interaction-endpoint.spec'))
  describe('Consent Endpoint', require('./consent-endpoint.spec'))
  describe('Token Endpoint', require('./token-endpoint.spec'))
  describe('PKCE Flow', require('./pkce-flow.spec'))
  describe('Full Trip Tests', require('./full-trip.spec'))
  describe('"oidc-provider" Configuration', require('./configuration.spec'))
  describe('Logout Endpoint', require('./logout-endpoint.spec'))
  describe('Abort Endpoint', require('./abort-endpoint.spec'))
  describe('Assertion Claims', require('./assertion-claims.spec'))
  describe('Users Domain', require('./users.spec'))
  describe('Repositories', require('./repositories.spec'))
  describe('IAL Flow', require('./ial.spec'))
}

module.exports = function () {
  const secrets = require('../config/secrets')
  const environment = require('../config/environment')
  const configs = [{
    name: 'Memory',
    setup: function () {
      this.environment = environment
      this.secrets = secrets
    },
    teardown: function () {}
  }, {
    name: 'MongoDB',
    setup: async function () {
      this.mongo = new MongoMemoryServer()
      const uri = await this.mongo.getUri()
      const repositories = { default: { type: 'mongodb', options: { uri } } }
      this.environment = environment
      this.secrets = { ...secrets, repositories }
    },
    teardown: function () {
      this.mongo.stop()
    }
  }]
  configs.forEach(({ name, setup, teardown }) => {
    describe(name + ' Adapter', function () {
      before('setup', setup)
      after('tear down', teardown)
      suite()
    })
  })
}
