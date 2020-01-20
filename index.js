'use strict'

const IAmId = require('./lib/app')
const resolvers = require('./lib/resolvers')
const IAmIdRouter = require('./lib/router')
const { normalize: normalizePhoneNumber } = require('./lib/phone-number')

module.exports = { IAmId, IAmIdRouter, resolvers, utils: { normalizePhoneNumber } }
