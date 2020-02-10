'use strict'

const IAmId = require('./lib/app')
const Configuration = require('./lib/configuration')
const resolvers = require('./lib/resolvers')
const IAmIdRouter = require('./lib/router')
const { normalize: normalizePhoneNumber } = require('./lib/phone-number')
const Sensitive = require('./lib/sensitive')
const users = require('./lib/users')

// TODO if we do the initialization in another way then we can remove repo from here
module.exports = { Configuration, IAmId, IAmIdRouter, resolvers, utils: { normalizePhoneNumber, Sensitive }, ...users }
