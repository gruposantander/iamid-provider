'use strict'

const { it, describe } = require('mocha')
const { deepEqual, throws } = require('assert').strict
const melt = require('../lib/melt')

describe('Object Melter', function () {
  const string1 = 'string-1'
  const string2 = 'string-2'
  const string3 = 'string-3'
  const SCHEMA = {}

  it('should merge multilevel object by default', function () {
    const object1 = { string1 }
    const base = { string1, object1 }
    const specific = { string2, object1: { string2 } }
    const melted = melt(SCHEMA, base, specific)
    deepEqual(melted, { string1, string2, object1: { string1, string2 } })
  })

  it('should not merge if schema say so', function () {
    const base = { object1: { string1 }, object2: { string1 } }
    const specific = { object1: { string2 }, object2: { string2 } }
    const schema = { properties: { object1: { merge: false } } }
    const melted = melt(schema, base, specific)
    deepEqual(melted, { object1: { string2 }, object2: { string1, string2 } })
  })

  it('should keep specific field in case of collision', function () {
    const base = { object1: { string1, string2 }, string1, string2 }
    const specific = { object1: { string1: string2 }, string1: string2 }
    const melted = melt(SCHEMA, base, specific)
    deepEqual(melted, { object1: { string1: string2, string2 }, string1: string2, string2 })
  })

  it('should support null values', function () {
    const base = { object1: { string1: null }, object2: { string1 }, string1: null, string2 }
    const specific = { object1: { string1 }, object2: { string1: null }, string1, string2: null }
    const melted = melt(SCHEMA, base, specific)
    deepEqual(melted, { object1: { string1 }, object2: { string1: null }, string1, string2: null })
  })

  it('should support null objects', function () {
    const base = { object1: null, object2: { string1 } }
    const specific = { object1: { string1 }, object2: null }
    const melted = melt(SCHEMA, base, specific)
    deepEqual(melted, { object1: { string1 }, object2: null })
  })

  it('should replace arrays completely', function () {
    const base = { array1: [1, 2] }
    const specific = { array1: [2, 3], array2: [1, 2] }
    const melted = melt(SCHEMA, base, specific)
    deepEqual(melted, { array1: [2, 3], array2: [1, 2] })
  })

  it('should allow several specific configurations', function () {
    const data1 = { string1, string2, string3 }
    const data2 = { string1: string2 }
    const configuration3 = { string2: string1 }
    const melted = melt(SCHEMA, data1, data2, configuration3)
    deepEqual(melted, { string1: string2, string2: string1, string3 })
  })

  it.skip('should object loops', function () {
    const data1 = { string1 }
    data1.object1 = data1
    const data2 = { string2 }
    data2.object1 = data2
    const melted = melt(SCHEMA, data1, data2)
    const expected = { string1, string2 }
    expected.object1 = expected
    deepEqual(melted, expected)
  })

  it('should validate the result', function () {
    const data1 = { data: string1 }
    const schema1 = { properties: { data: { type: 'banana' } } }
    throws(() => melt(schema1, data1, data1), {
      name: 'AssertionError',
      message: '$.data type "banana" is not supported'
    })
  })

  it('should allow optional schema', function () {
    const data1 = { data: string1 }
    const schema1 = undefined
    deepEqual(melt(schema1, data1, data1), data1)
  })
})
