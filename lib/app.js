'use strict'

const { Provider } = require('@santander/oidc-provider')
const Koa = require('koa')
const mount = require('koa-mount')
const helmet = require('koa-helmet')
const functions = require('./configuration/functions')
const Adapter = require('./adapter')
const melt = require('./melt')
const logger = require('log4js').getLogger('app')
// Keys for OP

class IAmId extends Koa {
  constructor (configuration, repositories) {
    super()
    // Provider configuration, the order is important to avoid overrides
    this.configuration = melt({}, configuration, functions(configuration, repositories))
    this.configuration.adapter = Adapter
    logger.trace('Configuration %j', this.configuration)
    Adapter.initialize(repositories)
    this.provider = new Provider(this.configuration.issuer, this.configuration)
    this.proxy = true
    this.use(helmet({
      hsts: { maxAge: 31536000 },
      frameguard: { action: 'DENY' },
      referrerPolicy: { policy: 'no-referrer' },
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
      noCache: true
    }))

    this.close = async function () {
      await repositories.close()
    }
  }

  async init () {
    this.use(mount(this.provider.app))
    return this
  }
}

module.exports = IAmId
