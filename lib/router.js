'use strict'

const Router = require('koa-router')
const bodyParser = require('koa-bodyparser')
const { SessionNotFound } = require('@santander/oidc-provider').errors
const { wrap } = require('./sensitive')
const { UnknownOperatorError, compile } = require('./assertion-lang')
const masked = require('./mask')
const { AssertionError } = require('./assertions')
const { Consent, Claims, Accepted } = require('./consent')
const { Unresolved, UnauthorizedError } = require('./resolvers')
const debug = require('debug')(require('../package').name + ':router')

const CONSENTS = 'consents'

class HTTPError extends Error {
  constructor (status, code, description) {
    super(description)
    this.status = status
    this.code = code
  }
}

class UserNotMatchError extends HTTPError {
  constructor (context) {
    super(403, 'incorrect_session', 'user does not match')
    this.context = context
  }
}

/**
 * Prepare the context to reach the authorization endpoint and continue the flow
 * @param {koa.Context} ctx koa Context
 * @param {string} interactionPath path to continue with the authorization
 * @param {string} sessionId uid of the authorization session
 */
function prepareToAuthorize (ctx, interactionPath) {
  ctx.method = 'GET'
  ctx.path = new URL(interactionPath).pathname
  ctx.app.emit('redirect.authorize', ctx, interactionPath)
}

class IAmIdRouter extends Router {
  constructor (configuration, repositories, resolver, router) {
    super()
    this.repositories = repositories
    const AUTH_PATH = configuration.routes.authorization
    const assertionClaimsSupported = new Map(Object.entries(configuration.discovery.claims_in_assertion_claims_supported))
    const claimsSupported = new Set(Object.keys(configuration.claims))
    const maskConfiguration = configuration.masks || { }
    // TODO Masked without configuration ??????
    const mask = masked()
    const INTERACTION_PATH = configuration.routes.interaction

    async function adaptCookies (ctx, next) {
      await next()
      const cookies = ctx.response.headers['set-cookie']
      if (cookies) {
        ctx.response.set('set-cookie', cookies.map((str) => str.replace(AUTH_PATH, INTERACTION_PATH)))
      }
    }

    function applyMask (claimName, value) {
      const configuration = maskConfiguration[claimName]
      if (configuration) {
        const { type, args } = configuration
        return mask(type, value, args)
      }
      return value
    }

    async function preInteractionChecks (ctx, next) {
      const { app: { provider }, req, res, params: { interactionId } } = ctx
      const interaction = await provider.interactionDetails(req, res)
      if (interactionId !== interaction.uid) {
        throw new SessionNotFound('Interaction cookie does not match interaction path')
      }
      ctx.interaction = interaction
      await next()
    }

    function handleFailure (ctx, status, code, description) {
      ctx.status = status
      ctx.body = {
        error: code,
        error_description: description
      }
    }

    function filterSupported (obj, supported) {
      Object.keys(obj).forEach((key) => {
        if (!supported.has(key)) {
          delete obj[key]
        }
      })
    }

    function applyResponse (obj, response) {
      Object.keys(obj).filter((key) => key !== 'assertion_claims').forEach((key) => {
        const claim = response[key]
        // TODO report an error
        const { resolved, unresolved } = claim.filterByIAL((obj[key] && obj[key].ial) || 1)
        const value = obj[key] || {}
        value.raw_result = wrap(resolved)
        value.result = resolved.map((item) => applyMask(key, item.value))
        value.unresolved = unresolved
        obj[key] = value
      })
    }

    async function errorHandler (ctx, next) {
      try {
        await next()
      } catch (err) {
        debug(err)
        ctx.app.emit('app.error', err, ctx)
        if (err instanceof SessionNotFound) {
          handleFailure(ctx, 404, 'session_not_found', err.error_description)
        } else if (err instanceof UnauthorizedError) {
          handleFailure(ctx, 401, 'invalid_credential', err.message)
        } else if (err instanceof HTTPError) {
          handleFailure(ctx, err.status, err.code, err.message)
        } else if (err instanceof AssertionError || err instanceof SyntaxError) {
          handleFailure(ctx, 400, 'invalid_request', err.message)
        } else {
          handleFailure(ctx, 500, 'internal_error', 'Internal Server Error')
        }
      }
    }

    function executeAssertions ({ assertion_claims: obj = {} }, response) {
      Object.keys(obj).forEach((key) => {
        const claim = response[key]
        // TODO report an error
        const { resolved, unresolved } = claim.filterByIAL((obj[key] && obj[key].ial) || 1)
        const value = obj[key] || {}
        value.unresolved = unresolved

        try {
          const compiled = compile(obj[key].assertion, assertionClaimsSupported.get(key))
          value.raw_result = wrap(resolved.filter((item) => compiled(item.value)))
        } catch (err) {
          if (err instanceof UnknownOperatorError) {
            value.raw_result = wrap([])
            value.unresolved = [new Unresolved('unknown_operator')].concat(value.unresolved)
          } else if (err instanceof SyntaxError) {
            value.raw_result = wrap([])
            value.unresolved = [new Unresolved('syntax_error')].concat(value.unresolved)
          } else {
            throw err
          }
        }
        value.result = value.raw_result.value.map((item) => applyMask(key, item.value))
        obj[key] = value
      })
    }

    async function resolveClaims (claimRequest, uid) {
      // TODO do not use Claims.fromJSON, create the Consent instance before.
      const claims = Claims.fromJSON((claimRequest && JSON.parse(claimRequest)) || {})
      const { id_token: idToken = {}, userinfo: userInfo = {} } = claims
      filterSupported(idToken, claimsSupported)
      filterSupported(userInfo, claimsSupported)
      filterSupported(idToken.assertion_claims || {}, assertionClaimsSupported)
      filterSupported(userInfo.assertion_claims || {}, assertionClaimsSupported)
      const entries = [
        ...Object.entries(idToken),
        ...Object.entries(userInfo),
        ...Object.entries(idToken.assertion_claims || {}),
        ...Object.entries(userInfo.assertion_claims || {})
      ]
      // TODO optimise, a TreeSet()
      const request = entries.reduce((result, [name, value]) => {
        const { ial = 1 } = value || {}
        const claim = result[name]
        result[name] = claim ? { ials: (claim.ials.includes(ial) ? claim.ials : [...claim.ials, ial].sort()) } : { ials: [ial] }
        return result
      }, {})
      delete request.assertion_claims
      const response = await resolver(uid, request)
      applyResponse(idToken, response)
      applyResponse(userInfo, response)
      executeAssertions(idToken, response)
      executeAssertions(userInfo, response)
      claims.id_token = idToken
      claims.userinfo = userInfo
      return claims
    }

    /**
     * Interaction endpoint handle the decision about what is the next steps in the authorization flow for the user.
     * @param {string} session_id uid of the authorization session
     */
    async function interaction (ctx) {
      const { interaction, app: { provider } } = ctx
      const { prompt, params, uid, session } = interaction
      const accountId = session && session.accountId
      if (prompt.name === 'login' || !accountId) {
        ctx.status = 200
        const state = params.state
        ctx.body = {
          interaction: 'login',
          interaction_id: uid,
          interaction_path: `/interaction/${uid}/login`,
          redirect_uri: params.redirect_uri,
          state,
          acr: params.acr_values || 'any'
        }
        ctx.app.emit('interaction.login', ctx, interaction)
      } else { // consent
        const { clientName, logoUri, tosUri, policyUri } = await provider.Client.find(params.client_id)
        // TODO this is quite dodgy. We need to merge the configuration and the request to get claims names

        const claims = await resolveClaims(params.claims, accountId)
        const scopes = params.scope.split(' ')
        const consent = Consent.createConsent(params.client_id, accountId, claims, scopes)
        const consents = await repositories.getRepository(CONSENTS)
        await consents.save(consent)

        ctx.status = 200
        const state = params.state
        const body = {
          interaction: 'consent',
          interaction_id: uid,
          interaction_path: `/interaction/${uid}/consent`,
          redirect_uri: params.redirect_uri,
          state,
          client: { clientName, logoUri, tosUri, policyUri },
          claims,
          scopes
        }
        ctx.body = body
        ctx.app.emit('interaction.consent', ctx, interaction)
      }
    }

    async function logout (ctx) {
      const { provider } = ctx.app
      const session = await provider.Session.get(ctx)
      ctx.app.emit('logout', ctx, session)
      await session.destroy()
      ctx.cookies.set(provider.cookieName('session'), null)
      ctx.cookies.set(`${provider.cookieName('session')}.legacy`, null)
      ctx.redirect(configuration.postLogoutRedirectURI)
    }

    async function abort (ctx, next) {
      const { interaction, app } = ctx
      const { uid } = interaction

      const result = {
        error: 'access_denied',
        error_description: 'End-User aborted interaction'
      }

      const interactionPath = await app.provider
        .interactionResult(ctx.req, ctx.res, result, { mergeWithLastSubmission: false })

      ctx.app.emit('abort', ctx, interaction)
      prepareToAuthorize(ctx, interactionPath)
      await next()

      const path = `${INTERACTION_PATH}/${uid}`
      const cookies = [ctx.app.provider.configuration('cookies.names.interaction')]
      cookies.forEach((name) => {
        ctx.cookies.set(name, null, { path })
        ctx.cookies.set(name + '.sig', null, { path })
      })
    }

    async function forceConsent (ctx, next) {
      ctx.request.query.prompt = 'consent'
      await next()
    }
    async function applyCustomAuthEndpoint (ctx, next) {
      await next()
      ctx.body.authorization_endpoint = configuration.customAuthorizationEndpoint
    }
    function validateClaimRequestGroup (name, claims) {
      const { [name]: group = {} } = claims
      const { assertion_claims: assertionClaims = {} } = group
      return Object.entries(assertionClaims).map(([key, value]) => {
        const schema = assertionClaimsSupported.get(key)
        if (!schema) {
          return { group: name + '.assertion_claims', key, description: 'assertions not supported on this claim' }
        }
        try {
          compile(value.assertion, assertionClaimsSupported.get(key))
        } catch (e) {
          return { group: name + '.assertion_claims', key, description: e.message }
        }
        return null
      }).filter((a) => a)
    }
    async function validateClaimRequest (ctx, next) {
      await next()
      if (ctx.status === 201 && typeof ctx.oidc.params.claims === 'string') {
        const claims = JSON.parse(ctx.oidc.params.claims)
        const errors = validateClaimRequestGroup('id_token', claims)
          .concat(validateClaimRequestGroup('userinfo', claims))
        if (errors.length) {
          ctx.body.errors = errors
        }
      }
    }

    const interactionUtilities = async (ctx, next) => {
      ctx.iamid = {
        processLogin: (userId, ctx, next) => this.processLogin(userId, ctx, next),
        processConsent: (consentData, ctx, next) => this.processConsent(consentData, ctx, next)
      }
      await next()
    }

    this
      .get(AUTH_PATH, forceConsent, adaptCookies)
      .post(configuration.routes.pushed_authorization_request, validateClaimRequest)
      .get('/.well-known/openid-configuration', applyCustomAuthEndpoint)
      .use(errorHandler)
      .post('/logout', logout)
      .use(INTERACTION_PATH + '/:interactionId', preInteractionChecks, bodyParser(), adaptCookies, interactionUtilities, router.routes())
      .get(INTERACTION_PATH + '/:interactionId', interaction)
      .post(INTERACTION_PATH + '/:interactionId/abort', abort)
  }

  /**
   * Used from login endpoint is used to provide the information about the login to the framework.
   * @param {string} userId The unique id of the User that has login in the system.
   * @param {*} ctx Koa context for the actual request.
   * @param {*} next Koa callback function.
   */
  async processLogin (userId, ctx, next) {
    const { app, interaction } = ctx
    const { provider } = app
    const result = { login: { account: userId } }
    const interactionPath = await provider.interactionResult(ctx.req, ctx.res, result, { mergeWithLastSubmission: false })
    app.emit('login', ctx, interaction, userId)
    prepareToAuthorize(ctx, interactionPath)
    await next()
  }

  /**
   * Used from consent endpoint is used to provide the information about the consent process to the framework.
   * @param {JSON} consentData A JSON object containing the consent information.
   * @param {*} ctx Koa context for the actual request.
   * @param {*} next Koa callback function.
   */
  async processConsent (consentData, ctx, next) {
    const { provider } = ctx.app
    const { interaction } = ctx

    const session = await provider.Session.get(ctx)
    const accountId = session.accountId()

    if (!accountId) {
      throw new HTTPError(401, 'session_not_found', 'user is not active')
    }

    if (accountId !== interaction.session.accountId) {
      throw new UserNotMatchError(interaction)
    }

    const consents = await this.repositories.getRepository(CONSENTS)

    const consent = await consents.findOne({ clientId: interaction.params.client_id, userId: accountId }, Consent.fromJSON)
    if (!consent) {
      throw new HTTPError(409, 'illegal_state', 'consent cannot be resolved before request')
    }

    const accepted = Accepted.fromJSON(consentData, true)
    // TODO user input should be validated and copy to entities
    const updated = consent.resolve(accepted)
    await consents.save(updated)

    const interactionPath = await provider
      .interactionResult(ctx.req, ctx.res, { consent: { } }, { mergeWithLastSubmission: true })
    ctx.app.emit('consent', ctx, interaction, updated)
    prepareToAuthorize(ctx, interactionPath)

    await next()
  }
}

IAmIdRouter.UserNotMatchError = UserNotMatchError
IAmIdRouter.HTTPError = HTTPError

module.exports = IAmIdRouter
