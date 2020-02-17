'use strict'

const IAmId = require('./lib/app')
const Configuration = require('./lib/configuration')
const { Repositories } = require('./lib/repositories')
const resolvers = require('./lib/resolvers')
const { HTTPError, UserNotMatchError } = require('./lib/router')
const { normalize: normalizePhoneNumber } = require('./lib/phone-number')
const Sensitive = require('./lib/sensitive')
const users = require('./lib/users')

const utils = {
  HTTPError, UserNotMatchError, normalizePhoneNumber, Sensitive
}

// TODO if we do the initialization in another way then we can remove repo from here
module.exports = { Configuration, Repositories, IAmId, resolvers, utils, ...users }
