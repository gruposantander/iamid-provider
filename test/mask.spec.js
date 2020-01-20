'use strict'

const { it } = require('mocha')
const masked = require('../lib/mask')
const { TypeNotFoundError } = masked
const { deepStrictEqual, throws } = require('assert')

module.exports = function () {
  const mask = masked()
  it('should have slice type', function () {
    deepStrictEqual(mask('slice', '1234567890', { begin: -4, prefix: '****' }), '****7890')
    deepStrictEqual(mask('slice', '1234567890', { begin: 0, end: 4, suffix: '****' }), '1234****')
    deepStrictEqual(mask('slice', 1234567890, { begin: 0, end: 4, suffix: '****' }), 1234567890)
    deepStrictEqual(mask('slice', null, { begin: 0, end: 4, suffix: '****' }), null)
  })

  it('should have fill type', function () {
    deepStrictEqual(mask('fill', '1234567890', { begin: 2, end: -2, filling: '*****' }), '12*****90')
    deepStrictEqual(mask('fill', '1234567890', { begin: 2, end: -2 }), '12****90')
    deepStrictEqual(mask('fill', 1234567890, { begin: 2, end: -2, filling: '****' }), 1234567890)
    deepStrictEqual(mask('fill', null, { begin: 2, end: -2, filling: '****' }), null)
  })

  it('should have email type', function () {
    deepStrictEqual(mask('email', 'banana@santander.co.uk'), 'b****a@santander.co.uk')
    deepStrictEqual(mask('email', null), null)
    deepStrictEqual(mask('email', 'without_at'), 'without_at')
  })

  it('should fail if type is missing', function () {
    throws(() => { mask('custard_apple', '1234567890') }, TypeNotFoundError, 'Missing mask type: custard_apple')
  })

  it('should allow adding more masks types', function () {
    const customMask = masked({
      phone_number: { type: 'slice', args: { begin: -4, prefix: '****' } },
      email_alias: { type: 'email' }
    })
    deepStrictEqual(customMask('phone_number', '1234567890'), '****7890')
    deepStrictEqual(customMask('email_alias', 'banana@santander.co.uk'), 'b****a@santander.co.uk')
  })
}
