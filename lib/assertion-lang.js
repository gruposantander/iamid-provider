'use strict'

const { normalize } = require('./phone-number')

class UnknownOperatorError extends Error {
  constructor (operator) {
    super('unknown operator: ' + operator)
    this.name = this.constructor.name
  }
}

function convertTo (value, { type }) {
  if (value === null) return null
  if (type === 'decimal') return Number.parseFloat(value)
  if (type === 'phone_number') return normalize(value)
  return value
}

function push (tests, test, schema, fn) {
  if (test !== undefined) tests.push(fn(convertTo(test, schema)))
}

const eq = (test) => (value) => value === test ||
    (typeof value === 'string' && typeof test === 'string' &&
    value.toUpperCase() === test.toUpperCase())
const gt = (test) => (value) => value > test
const lt = (test) => (value) => value < test
const gte = (test) => (value) => value >= test
const lte = (test) => (value) => value <= test

function deep (properties, schema) {
  const schemas = (schema.type === 'object' && schema.properties) || {}
  const tests = Object.entries(properties)
    .filter(([_, test]) => test && typeof test === 'object')
    .map(([key, test]) => [key, compile(test, schemas[key])])
    .map(([key, compiled]) => (value) => compiled(value[key]))

  return (value) => tests.every((test) => test(value))
}

function compile (raw, schema = { type: 'unknown' }) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw SyntaxError('expression should be an object')
  }
  const { $eq, $gt, $lt, $gte, $lte, ...properties } = raw
  const unknownOperator = Object.keys(properties).find((key) => key.startsWith('$'))
  if (unknownOperator) {
    throw new UnknownOperatorError(unknownOperator)
  }
  const tests = []
  push(tests, $eq, schema, eq)
  push(tests, $gt, schema, gt)
  push(tests, $lt, schema, lt)
  push(tests, $gte, schema, gte)
  push(tests, $lte, schema, lte)
  tests.push(deep(properties, schema))

  return (value) => {
    if (value === undefined) return false
    const converted = convertTo(value, schema)
    return tests.every((test) => test(converted))
  }
}

function filterValues (values, test, schema) {
  const compiled = compile(test, schema)
  return values.filter(compiled)
}

module.exports = {
  compile,
  filterValues,
  UnknownOperatorError
}
