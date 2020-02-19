'use strict'

const assert = require('assert').strict
const { AssertionError } = assert

function assertObject (obj, msg) {
  return assert(obj && typeof obj === 'object', msg)
}

function assertStringArray (arr, msg) {
  return assert(Array.isArray(arr) && arr.every((item) => typeof item === 'string'), msg)
}

function throwAssertionError (message) {
  throw new AssertionError({ message })
}

module.exports = {
  assert, assertObject, assertStringArray, AssertionError, throwAssertionError
}
