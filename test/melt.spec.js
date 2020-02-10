'use strict'

const { it, describe } = require('mocha')
const { deepEqual } = require('assert').strict
const melt = require('../lib/melt')

describe('Configuration Constrains', function () {
  const string1 = 'string-1'
  const string2 = 'string-2'
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
})
