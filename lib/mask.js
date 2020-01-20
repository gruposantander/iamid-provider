'use strict'

function slice (value, { begin, end, prefix = '', suffix = '' }) {
  if (typeof value === 'string') {
    return prefix + value.slice(begin, end) + suffix
  }
  return value
}

function fill (value, { begin, end, filling = '****' }) {
  if (typeof value === 'string') {
    return value.slice(0, begin) + filling + value.slice(end)
  }
  return value
}

function email (value, { filling = '****' }) {
  if (typeof value === 'string') {
    const at = value.indexOf('@')
    if (at > 2) {
      return value.slice(0, 1) + filling + value.slice(at - 1)
    }
  }
  return value
}

class TypeNotFoundError extends Error {}

const BASE_MASKS = new Map([['slice', slice], ['fill', fill], ['email', email]])

function build (cfg = {}) {
  const fns = new Map(BASE_MASKS)
  for (const [key, { type, args = {} }] of Object.entries(cfg)) {
    fns.set(key, (value) => fns.get(type)(value, args))
  }
  return function mask (type, value, args = {}) {
    const fn = fns.get(type)
    if (fn) {
      return fn(value, args)
    }
    throw new TypeNotFoundError('Missing mask type: ' + type)
  }
}

build.BASE_MASKS = BASE_MASKS
build.TypeNotFoundError = TypeNotFoundError

module.exports = build
