'use strict'

const { it, describe } = require('mocha')
const { deepEqual, throws } = require('assert').strict
const melt = require('../lib/melt')

describe('Object Melter', function () {
  const number1 = 1
  const string1 = 'string-1'
  const string2 = 'string-2'
  const string3 = 'string-3'
  const rules = {}

  it('should merge multilevel object by default', function () {
    const object1 = { string1 }
    const base = { string1, object1 }
    const specific = { string2, object1: { string2 } }
    const melted = melt(rules, base, specific)
    deepEqual(melted, { string1, string2, object1: { string1, string2 } })
  })

  it('should not merge if rules say so', function () {
    const base = { object1: { string1 }, object2: { string1 } }
    const specific = { object1: { string2 }, object2: { string2 } }
    const rules = { object1: { $melt: false } }
    const melted = melt(rules, base, specific)
    deepEqual(melted, { object1: { string2 }, object2: { string1, string2 } })
  })

  it('should keep specific field in case of collision', function () {
    const base = { object1: { string1, string2 }, string1, string2 }
    const specific = { object1: { string1: string2 }, string1: string2 }
    const melted = melt(rules, base, specific)
    deepEqual(melted, { object1: { string1: string2, string2 }, string1: string2, string2 })
  })

  it('should support null values', function () {
    const base = { object1: { string1: null }, object2: { string1 }, string1: null, string2 }
    const specific = { object1: { string1 }, object2: { string1: null }, string1, string2: null }
    const melted = melt(rules, base, specific)
    deepEqual(melted, { object1: { string1 }, object2: { string1: null }, string1, string2: null })
  })

  it('should support null objects', function () {
    const base = { object1: null, object2: { string1 } }
    const specific = { object1: { string1 }, object2: null }
    const melted = melt(rules, base, specific)
    deepEqual(melted, { object1: { string1 }, object2: null })
  })

  it('should replace arrays completely', function () {
    const base = { array1: [1, 2] }
    const specific = { array1: [2, 3], array2: [1, 2] }
    const melted = melt(rules, base, specific)
    deepEqual(melted, { array1: [2, 3], array2: [1, 2] })
  })

  it('should allow several specific configurations', function () {
    const cfg1 = { string1, string2, string3 }
    const cfg2 = { string1: string2 }
    const configuration3 = { string2: string1 }
    const melted = melt(rules, cfg1, cfg2, configuration3)
    deepEqual(melted, { string1: string2, string2: string1, string3 })
  })

  it.skip('should object loops', function () {
    const cfg1 = { string1 }
    cfg1.object1 = cfg1
    const cfg2 = { string2 }
    cfg2.object1 = cfg2
    const melted = melt(rules, cfg1, cfg2)
    const expected = { string1, string2 }
    expected.object1 = expected
    deepEqual(melted, expected)
  })

  describe('Assertion', function () {
    it('should return the result if the result complies with rules', function () {
      const cfg1 = { string1 }
      const cfg2 = { string1: string2 }
      const rules = { string1: { $type: 'string' } }
      const melted = melt(rules, cfg1, cfg2)
      deepEqual(melted, cfg2)
    })

    it('should support different types', function () {
      const cfg1 = { data: string1 }
      const cfg2 = { data: number1 }
      const cfg3 = { data: {} }
      const cfg4 = { data: [] }

      const rules1 = { data: { $type: 'string' } }
      const rules2 = { data: { $type: 'number' } }
      const rules3 = { data: { $type: 'object' } }
      const rules4 = { data: { $type: 'array' } }

      deepEqual(melt(rules2, cfg1, cfg2), cfg2)
      throws(() => melt(rules1, cfg1, cfg2), { message: '$.data must be a string' })

      deepEqual(melt(rules1, cfg2, cfg1), cfg1)
      throws(() => melt(rules2, cfg2, cfg1), { message: '$.data must be a number' })

      // Arrays and objects could have collisions, the following tests prevent that
      deepEqual(melt(rules3, cfg4, cfg3), cfg3)
      throws(() => melt(rules3, cfg3, cfg4), { message: '$.data must be an object' })

      deepEqual(melt(rules4, cfg3, cfg4), cfg4)
      throws(() => melt(rules4, cfg4, cfg3), { message: '$.data must be an array' })
    })

    it('should throw an error if the type is not supported', function () {
      const cfg1 = { data: string1 }
      const rules1 = { data: { $type: 'banana' } }
      throws(() => melt(rules1, cfg1, cfg1), {
        name: 'AssertionError',
        message: '$.data type "banana" is not supported'
      })
    })

    it('should throw an error if result does not comply with the rules', function () {
      const cfg1 = { object1: { string1 } }
      const cfg2 = { object1: { string1: 1 } }
      const rules = { object1: { string1: { $type: 'string' } } }
      throws(() => melt(rules, cfg1, cfg2), {
        name: 'AssertionError',
        message: '$.object1.string1 must be a string'
      })
    })

    it('should require every field at rules by default', function () {
      const cfg1 = {}
      const rules = { string1: { $type: 'string' } }
      throws(() => melt(rules, cfg1, cfg1), {
        name: 'AssertionError',
        message: '$.string1 is required'
      })
    })
  })
})
