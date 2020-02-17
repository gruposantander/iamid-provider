'use strict'

const { IAmIdRouter, resolvers: { UnauthorizedError } } = require('../..')
const Router = require('koa-router')
const { HTTPError } = IAmIdRouter

class CredentialValidationError extends HTTPError {
  constructor (context) {
    super(400, 'invalid_request', 'authentication fail')
    this.context = context
  }
}

class UnauthorizedContextError extends HTTPError {
  constructor (err, context) {
    super(401, 'invalid_credential', err.message)
    this.context = context
  }
}

class SantanderUKInteractionRouter extends Router {
  constructor (login) {
    super()

    /**
     * Login endpoint execute the login of the user against minibank system
     * @param {string} session_id uid of the authorization session
     */
    async function loginHandler (ctx, next) {
      const { interaction } = ctx
      const { body: { user, pass } } = ctx.request

      // Simple input validation can be more complex...
      if (!user || !pass) {
        throw new CredentialValidationError(interaction)
      }

      let userId
      try {
        userId = await login(user, pass)
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          throw new UnauthorizedContextError(err, interaction)
        }
        throw err
      }
      await ctx.iamid.processLogin(userId, ctx, next)
    }

    /**
     * consent endpoint store the consent information decided by the user
     * @param {string} session_id uid of the authorization session
     */
    async function consentHandler (ctx, next) {
      await ctx.iamid.processConsent(ctx.request.body, ctx, next)
    }

    this
      .post('/login', loginHandler)
      .post('/consent', consentHandler)
  }
}

SantanderUKInteractionRouter.CredentialValidationError = CredentialValidationError
SantanderUKInteractionRouter.UnauthorizedContextError = UnauthorizedContextError

module.exports = SantanderUKInteractionRouter
