'use strict'

const { equal, notEqual, fail, ok } = require('assert').strict

function isObject (any) {
  return any && typeof any === 'object' && !Array.isArray(any)
}

function validate (schema, current, path = '$') {
  const { type = 'object', nullable = false } = schema
  ok(current !== null || nullable, `${path} is not nullable`)
  notEqual(current, undefined, `${path} is required`)
  if (type === 'string') {
    equal(typeof current, type, `${path} must be a string`)
  } else if (type === 'number') {
    equal(typeof current, type, `${path} must be a number`)
  } else if (type === 'object') {
    ok(isObject(current), `${path} must be an object`)
    const { properties, children } = schema
    if (properties) {
      const entries = Object.entries(properties)
      for (const [key, value] of entries) {
        validate(value, current[key], path + '.' + key)
      }
    } else if (children) {
      for (const [key, value] of Object.entries(current)) {
        validate(children, value, path + '.' + key)
      }
    }
  } else if (type === 'array') {
    ok(Array.isArray(current), `${path} must be an array`)
  } else if (type === 'boolean') {
    equal(typeof current, type, `${path} must be a boolean`)
  } else if (type) {
    fail(`${path} type "${type}" is not supported`)
  }
}

module.exports = { validate }
