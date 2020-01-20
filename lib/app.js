'use strict'

'use strict'

const { Provider } = require('@santander/oidc-provider')
const Koa = require('koa')
const mount = require('koa-mount')
const helmet = require('koa-helmet')
const { Repositories } = require('./repositories')
const Adapter = require('./adapter')
const logger = require('log4js').getLogger('app')
// Keys for OP

const { DEFAULT_ENVIRONMENT, DEFAULT_SECRET, DEFAULT_REPOSITORIES, FIXED, functions } = require('./configuration')

class IAmId extends Koa {
  constructor (environment, secrets) {
    super()

    // Provider configuration, the order is important to avoid overrides
    const merged = { ...DEFAULT_ENVIRONMENT, ...environment, ...DEFAULT_SECRET, ...secrets, ...FIXED }
    this.configuration = { ...merged, ...functions(merged), adapter: Adapter }
    logger.trace('Configuration %j', this.configuration)
    this.configuration.repositories = { ...DEFAULT_REPOSITORIES, ...this.configuration.repositories }
    this.repositories = new Repositories(this.configuration.repositories)
    Adapter.initialize(this.repositories)
    this.provider = new Provider(this.configuration.issuer, this.configuration)
    this.proxy = true
    this.use(helmet({
      hsts: { maxAge: 31536000 },
      frameguard: { action: 'DENY' },
      referrerPolicy: { policy: 'no-referrer' },
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
      noCache: true
    }))
  }

  async init () {
    this.use(mount(this.provider.app))
    return this
  }

  async close () {
    await this.repositories.close()
  }
}

module.exports = IAmId
