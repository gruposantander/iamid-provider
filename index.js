'use strict'

const IAmId = require('./lib/app')
const resolvers = require('./lib/resolvers')
const IAmIdRouter = require('./lib/router')
const { normalize: normalizePhoneNumber } = require('./lib/phone-number')
const Sensitive = require('./lib/sensitive')
const users = require('./lib/users')

// TODO if we do the initialization in another way then we can remove repo from here
module.exports = { IAmId, IAmIdRouter, resolvers, utils: { normalizePhoneNumber, Sensitive }, ...users }
