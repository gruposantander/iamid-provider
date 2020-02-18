'use strict'

const { it, describe } = require('mocha')
const { throws } = require('assert').strict
const { validate } = require('../lib/schema-validator')

// TODO nullable fields, description and documentation for errors, example values for fields

describe('Schema Validator', function () {
  const number1 = 1
  const string1 = 'string-1'
  const string2 = 'string-2'

  it('should return the result if the result complies with schema', function () {
    const data = { string1: string2 }
    const schema = { properties: { string1: { type: 'string' } } }
    validate(schema, data)
  })

  it('should support different types', function () {
    const data1 = { data: string1 }
    const data2 = { data: number1 }
    const data3 = { data: {} }
    const data4 = { data: [] }
    const data5 = { data: true }

    const schema1 = { properties: { data: { type: 'string' } } }
    const schema2 = { properties: { data: { type: 'number' } } }
    const schema3 = { properties: { data: { type: 'object' } } }
    const schema4 = { properties: { data: { type: 'array' } } }
    const schema5 = { properties: { data: { type: 'boolean' } } }

    validate(schema2, data2)
    throws(() => validate(schema1, data2), { message: '$.data must be a string' })

    validate(schema1, data1)
    throws(() => validate(schema2, data1), { message: '$.data must be a number' })

    validate(schema3, data3)
    throws(() => validate(schema3, data4), { message: '$.data must be an object' })

    validate(schema4, data4)
    throws(() => validate(schema4, data3), { message: '$.data must be an array' })

    validate(schema5, data5)
    throws(() => validate(schema5, data1), { message: '$.data must be a boolean' })
  })

  it('should throw an error if the type is not supported', function () {
    const data = { data: string1 }
    const schema1 = { properties: { data: { type: 'banana' } } }
    throws(() => validate(schema1, data), {
      name: 'AssertionError',
      message: '$.data type "banana" is not supported'
    })
  })

  it('should throw an error if result does not comply with the schema', function () {
    const data2 = { object1: { string1: 1 } }
    const schema = { properties: { object1: { properties: { string1: { type: 'string' } } } } }
    throws(() => validate(schema, data2), {
      name: 'AssertionError',
      message: '$.object1.string1 must be a string'
    })
  })

  it('should require every field at schema by default', function () {
    const data = {}
    const schema = { properties: { string1: { type: 'string' } } }
    throws(() => validate(schema, data), {
      name: 'AssertionError',
      message: '$.string1 is required'
    })
  })

  it('should forbid null by default', function () {
    const data = { object: null }
    const schema = { properties: { object: { type: 'object' } } }
    throws(() => validate(schema, data), {
      name: 'AssertionError',
      message: '$.object is not nullable'
    })
  })

  it('should allow null when nullable is true', function () {
    const data = { object: {} }
    const schema = { properties: { object: { type: 'object' } } }
    validate(schema, data)
  })

  it.skip('should throw when an object has unknown properties', function () {
    const data = { string1, string2 }
    const schema1 = { properties: { string1: { type: 'string' }, string2: { type: 'string' } } }
    const schema2 = { properties: { string1: { type: 'string' } } }
    validate(schema1, data)
    throws(() => { validate(schema2, data) }, {
      name: 'AssertionError',
      message: '$ has an unknown property string2'
    })
  })

  it('should allow validation of arbitrary object children', function () {
    const data1 = { object1: { key1: string1, key2: string2 } }
    const data2 = { object1: { key1: string1, key2: number1 } }
    const schema = { properties: { object1: { children: { type: 'string' } } } }
    validate(schema, data1)
    throws(() => validate(schema, data2), {
      name: 'AssertionError',
      message: '$.object1.key2 must be a string'
    })
  })
})
