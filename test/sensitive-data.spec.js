'use strict'
const { it } = require('mocha')
const { deepEqual } = require('assert').strict
const Sensitive = require('../lib/sensitive')

module.exports = function () {
  const data = 'sensitive-data'
  const actual = { a: 'data', b: Sensitive.wrap(data), c: null, d: undefined, e: () => {}, f: NaN }
  actual.e() // for coverage only
  const expected = { a: 'data', c: null, f: null }
  it('should hide data in JSON serialization', function () {
    deepEqual(
      JSON.parse(JSON.stringify(actual)),
      expected)
  })
  it('should provide access to the sensible data', function () {
    deepEqual(actual.b.value, data)
  })
  it('should show data if we use the given replacer', function () {
    deepEqual(
      JSON.parse(JSON.stringify(actual, Sensitive.unwrap)),
      { ...expected, b: { value: data } })
  })
  it('should show data if we use the given replacer (array and object support)', function () {
    const actual = { a: Sensitive.wrap([1, 2]), b: Sensitive.wrap({ a: 1, b: 2 }) }
    deepEqual(
      JSON.parse(JSON.stringify(actual, Sensitive.unwrap)),
      { a: { value: [1, 2] }, b: { value: { a: 1, b: 2 } } })
  })
}
