'use strict'

const pkg = require('../package')
const { describe } = require('mocha')

describe(pkg.name, function () {
  describe('Sensitive Data Wrapper', require('./sensitive-data.spec'))
  describe('Phone Number', require('./phone-number.spec'))
  describe('Mask types', require('./mask.spec'))
  describe('Assertion Language', require('./assertion-lang.spec'))
  describe('Resolvers', require('./resolvers.spec'))
  describe('IAmId', require('./app/app.spec'))
})
