'use strict'

class ValidationError extends Error {}

function assert (condition, message) {
  if (!condition) {
    throw new ValidationError(message)
  }
}

function isObject (obj) {
  return obj && typeof obj === 'object'
}

function isStringArray (arr) {
  return Array.isArray(arr) && arr.every((item) => typeof item === 'string')
}

function isNotEmptyString (str) {
  return !(!str || str.length === 0)
}

module.exports = {
  assert, isObject, isStringArray, isNotEmptyString, ValidationError
}
