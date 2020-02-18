'use strict'

const Router = require('koa-router')

class SantanderUKInteractionRouter extends Router {
  constructor (login) {
    super()

    async function loginHandler (ctx, next) {
      const { body: { user, pass } } = ctx.request
      const userId = await login(user, pass)
      await ctx.iamid.processLogin(userId, ctx, next)
    }

    async function consentHandler (ctx, next) {
      await ctx.iamid.processConsent(ctx.request.body, ctx, next)
    }

    this
      .post('/login', loginHandler)
      .post('/consent', consentHandler)
  }
}

module.exports = SantanderUKInteractionRouter
