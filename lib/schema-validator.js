'use strict'

const { equal, notEqual, fail, ok } = require('assert').strict

function isObject (any) {
  return any && typeof any === 'object' && !Array.isArray(any)
}

function validate (schema, current, path = '$') {
  const { type, properties, children, nullable = false } = schema
  ok(current !== null || nullable, `${path} is not nullable`)
  notEqual(current, undefined, `${path} is required`)
  if (type === 'string') {
    equal(typeof current, type, `${path} must be a string`)
  } else if (type === 'number') {
    equal(typeof current, type, `${path} must be a number`)
  } else if (type === 'object') {
    ok(isObject(current), `${path} must be an object`)
  } else if (type === 'array') {
    ok(Array.isArray(current), `${path} must be an array`)
  } else if (type) {
    fail(`${path} type "${type}" is not supported`)
  }
  if (properties) {
    for (const [key, value] of Object.entries(properties)) {
      validate(value, current[key], path + '.' + key)
    }
  } else if (children) {
    for (const [key, value] of Object.entries(current)) {
      validate(children, value, path + '.' + key)
    }
  }
}

module.exports = { validate }
