'use strict'

const { Provider } = require('@santander/oidc-provider')
const Koa = require('koa')
const mount = require('koa-mount')
const helmet = require('koa-helmet')
const functions = require('./configuration/functions')
const Adapter = require('./adapter')
const melt = require('./melt')
const logger = require('log4js').getLogger('app')
const Router = require('./router')
// Keys for OP

function routeProviderEvents (source, target) {
  const names = [
    'pushed_authorization_request.success',
    'pushed_authorization_request.error',
    'interaction.started',
    'interaction.ended',
    'authorization.accepted',
    'authorization.error',
    'grant.success',
    'grant.error'
  ]
  for (const name of names) {
    source.on(name, (...args) => target.emit(name, ...args))
  }
}

class IAmId extends Koa {
  constructor (configuration, interactionRouter, repositories, resolver) {
    super()
    // Provider configuration, the order is important to avoid overrides
    const melted = melt({}, configuration, functions(configuration, repositories))
    melted.adapter = Adapter
    logger.trace('Configuration %j', melted)
    Adapter.initialize(repositories)
    this.provider = new Provider(melted.issuer, melted)
    routeProviderEvents(this.provider, this)
    this.proxy = true
    this.use(helmet({
      hsts: { maxAge: 31536000 },
      frameguard: { action: 'DENY' },
      referrerPolicy: { policy: 'no-referrer' },
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
      noCache: true
    }))

    const router = new Router(configuration, repositories, resolver, interactionRouter)
    this.use(router.routes())
    this.use(mount(this.provider.app))
  }
}

module.exports = IAmId
