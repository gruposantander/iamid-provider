'use strict'
const { interactionPolicy: { base, Check } } = require('@gruposantander/oidc-provider')
const { Consent } = require('../consent')

module.exports = function (configuration, repositories) {
  const INTERACTION_SECONDS = Math.trunc(configuration.cookies.short.maxAge / 1000)

  const policy = base()
  policy.get('login').checks.add(new Check('longer_interaction', 'interaction expiration is greater that session', 'login_required', async (ctx) => {
    const { path, oidc: { session } } = await ctx
    if (path === configuration.routes.authorization && session && session.exp) {
      const diff = session.exp - Math.trunc(Date.now() / 1000)
      return INTERACTION_SECONDS >= diff
    }
    return false
  }))

  function findAccount (ctx, id) {
    return {
      accountId: id,
      async claims (use) {
        const consents = await repositories.getRepository('consents')
        // TODO if consent is missing
        const auth = ctx.oidc.entities.AuthorizationCode || ctx.oidc.entities.AccessToken
        const consent = await consents.findOne({ clientId: ctx.oidc.client.clientId, userId: id, interactionId: auth.interactionId }, Consent.fromJSON)
        const claims = consent.claimsFor(use)
        ctx.app.emit('claims.consumed', ctx, consent, id, claims)
        return claims
      }
    }
  }

  async function pairwiseIdentifier (ctx, accountId, client) {
    return require('crypto').createHash('sha256')
      .update(client.sectorIdentifier)
      .update(accountId)
      .update(configuration.pairwiseSalt)
      .digest('hex')
  }

  async function renderError (ctx, out) {
    ctx.body = out
  }

  async function url (ctx) {
    return `${configuration.routes.interaction}/${ctx.oidc.uid}`
  }

  return {
    findAccount,
    pairwiseIdentifier,
    renderError,
    interactions: { policy, url }
  }
}
