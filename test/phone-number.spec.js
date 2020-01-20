'use strict'

const { describe, it } = require('mocha')
const phones = require('../lib/phone-number')
const { equal } = require('assert').strict

module.exports = function () {
  describe('Normalization', function () {
    const expected = '+447523503388'
    const { normalize } = phones
    it('should understand UK numbers with mid 0', function () {
      equal(normalize('+44-07523503388'), expected)
      equal(normalize('+4407523503388'), expected)
    })
    it('should return null when the number is not right', function () {
      equal(normalize('+BANANA'), null)
    })
    it('should use GB as the default country', function () {
      equal(normalize('07523503388'), expected)
      equal(normalize('7523503388'), expected)
    })
    it('should understand tel URI format', function () {
      equal(normalize('tel:+44-7523-503-388'), expected)
    })
    it('should normalize several formats', function () {
      equal(normalize(expected), expected)
      equal(normalize('07523 503388'), expected)
      equal(normalize('07523 503 388'), expected)
      equal(normalize('+44 (0) 7523 503 388'), expected)
      equal(normalize('+34-629-412-269'), '+34629412269')
    })
  })
}
