'use strict'

const { it, describe } = require('mocha')
const { deepEqual } = require('assert').strict
const melt = require('../lib/melt')

describe('Object Melter', function () {
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
    const configuration1 = { string1, string2, string3 }
    const configuration2 = { string1: string2 }
    const configuration3 = { string2: string1 }
    const melted = melt(rules, configuration1, configuration2, configuration3)
    deepEqual(melted, { string1: string2, string2: string1, string3 })
  })

  it.skip('should object loops', function () {
    const configuration1 = { string1 }
    configuration1.object1 = configuration1
    const configuration2 = { string2 }
    configuration2.object1 = configuration2
    const melted = melt(rules, configuration1, configuration2)
    const expected = { string1, string2 }
    expected.object1 = expected
    deepEqual(melted, expected)
  })
})
